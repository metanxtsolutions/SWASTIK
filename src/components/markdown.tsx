import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A small, safe Markdown subset for owner-written content (guides, policies,
 * category introductions): ## and ### headings, paragraphs, - and 1. lists,
 * **bold**, *italic* and [links](/path or https://). Raw HTML is never rendered:
 * text becomes React text nodes, so it is always escaped.
 */

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("*")) out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    else {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)!;
      const href = lm[2];
      if (/^\/(?!\/)/.test(href)) out.push(<Link key={key} href={href}>{lm[1]}</Link>);
      else if (/^https:\/\//.test(href)) out.push(<a key={key} href={href} rel="noopener noreferrer nofollow" target="_blank">{lm[1]}</a>);
      else out.push(lm[1]);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = source.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const nodes: ReactNode[] = [];
  blocks.forEach((block, bi) => {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    if (!lines.length) return;
    const first = lines[0];
    if (/^###\s+/.test(first) && lines.length === 1) nodes.push(<h3 key={bi}>{inline(first.replace(/^###\s+/, ""), `h${bi}`)}</h3>);
    else if (/^##\s+/.test(first) && lines.length === 1) nodes.push(<h2 key={bi}>{inline(first.replace(/^##\s+/, ""), `h${bi}`)}</h2>);
    else if (lines.every((l) => /^\s*[-*]\s+/.test(l))) nodes.push(<ul key={bi}>{lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*[-*]\s+/, ""), `u${bi}-${li}`)}</li>)}</ul>);
    else if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) nodes.push(<ol key={bi}>{lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*\d+[.)]\s+/, ""), `o${bi}-${li}`)}</li>)}</ol>);
    else if (/^#{2,3}\s+/.test(first)) {
      const Tag = first.startsWith("###") ? "h3" : "h2";
      nodes.push(<Tag key={`${bi}h`}>{inline(first.replace(/^#{2,3}\s+/, ""), `h${bi}`)}</Tag>);
      nodes.push(<p key={`${bi}p`}>{inline(lines.slice(1).join(" "), `p${bi}`)}</p>);
    } else nodes.push(<p key={bi}>{inline(lines.join(" "), `p${bi}`)}</p>);
  });
  return <div className={className ?? "prose-swastik"}>{nodes}</div>;
}

/** Plain text of Markdown, for meta descriptions and structured data. */
export function markdownToText(source: string): string {
  return source
    .replace(/^#{2,3}\s+/gm, "")
    .replace(/^\s*([-*]|\d+[.)])\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
