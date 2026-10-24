import { heroArtSvg, illustrationSvg, type IllustrationKind } from "@/lib/illustrations";

const KINDS: IllustrationKind[] = ["marigold", "rose", "jasmine", "hibiscus", "lotus", "leaves", "garland", "bundle", "daily", "festival", "generic"];

export const dynamic = "force-static";

export function generateStaticParams() {
  return [...KINDS, "hero"].map((k) => ({ file: `${k}.svg` }));
}

/** Placeholder illustrations as cacheable files, so pages do not inline them. */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const kind = file.replace(/\.svg$/, "");
  if (kind !== "hero" && !KINDS.includes(kind as IllustrationKind)) return new Response("Not found", { status: 404 });
  const svg = kind === "hero" ? heroArtSvg() : illustrationSvg(kind as IllustrationKind);
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800", "X-Content-Type-Options": "nosniff" } });
}
