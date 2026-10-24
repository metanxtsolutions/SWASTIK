import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { JsonLd } from "./json-ld";

export interface Crumb {
  name: string;
  href?: string;
}

export function Breadcrumbs({ items, baseUrl }: { items: Crumb[]; baseUrl: string }) {
  const all: Crumb[] = [{ name: "Home", href: "/" }, ...items];
  return (
    <>
      <nav aria-label="Breadcrumb" className="no-scrollbar overflow-x-auto">
        <ol className="flex items-center gap-1 whitespace-nowrap text-sm text-muted">
          {all.map((c, i) => (
            <li key={i} className="flex items-center gap-1">
              {i > 0 ? <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0" /> : null}
              {c.href && i < all.length - 1 ? (
                <Link href={c.href} className="hover:text-saffron-dark hover:underline">
                  {c.name}
                </Link>
              ) : (
                <span aria-current={i === all.length - 1 ? "page" : undefined} className={i === all.length - 1 ? "font-medium text-ink-soft" : ""}>
                  {c.name}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: all.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, ...(c.href ? { item: new URL(c.href, baseUrl).toString() } : {}) })),
        }}
      />
    </>
  );
}
