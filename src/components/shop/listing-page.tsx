import Link from "next/link";
import { ArrowUpDown } from "lucide-react";
import type { CategoryView, ProductCard } from "@/server/services/catalog";
import { Markdown } from "../markdown";
import { Breadcrumbs, type Crumb } from "./breadcrumbs";
import { EmptyState } from "./empty-state";
import { FaqList } from "./faq-list";
import { ProductGrid } from "./product-card";
import { JsonLd } from "./json-ld";

interface Props {
  baseUrl: string;
  crumbs: Crumb[];
  title: string;
  summary: string;
  intro: string;
  products: ProductCard[];
  sortHref: string;
  faqs: { id: string; question: string; answer: string }[];
  guides: { slug: string; title: string; excerpt: string }[];
  siblings: Pick<CategoryView, "id" | "slug" | "name">[];
  siblingBase: string;
  canonicalPath: string;
}

/** Shared layout for category and collection pages. */
export function ListingPage(p: Props) {
  return (
    <div className="container-page py-6">
      <Breadcrumbs baseUrl={p.baseUrl} items={p.crumbs} />
      <header className="mt-3 max-w-3xl">
        <h1 className="text-3xl font-semibold sm:text-4xl">{p.title}</h1>
        {p.summary ? <p className="mt-2 text-lg text-ink-soft">{p.summary}</p> : null}
      </header>
      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {p.products.length} product{p.products.length === 1 ? "" : "s"}
        </p>
        <Link href={p.sortHref} className="btn btn-secondary btn-sm">
          <ArrowUpDown aria-hidden className="h-4 w-4" />
          Sort and filter
        </Link>
      </div>
      <div className="mt-4">{p.products.length ? <ProductGrid products={p.products} priorityCount={4} /> : <EmptyState title="Nothing here yet" body="Please check back soon." action={{ label: "Browse all flowers", href: "/shop" }} />}</div>
      {p.intro ? (
        <section className="mt-12 max-w-3xl">
          <Markdown source={p.intro} />
        </section>
      ) : null}
      {p.faqs.length ? (
        <section aria-labelledby="listing-faq" className="mt-12 max-w-3xl">
          <h2 id="listing-faq" className="section-title mb-4">
            Questions about {p.title.toLowerCase()}
          </h2>
          <FaqList faqs={p.faqs} />
        </section>
      ) : null}
      {p.guides.length ? (
        <section aria-labelledby="listing-guides" className="mt-12">
          <h2 id="listing-guides" className="section-title mb-4">
            Related guides
          </h2>
          <ul className="grid gap-4 md:grid-cols-3">
            {p.guides.map((g) => (
              <li key={g.slug} className="card p-5">
                <Link href={`/guides/${g.slug}`} className="text-lg font-semibold hover:text-saffron-dark">
                  {g.title}
                </Link>
                <p className="mt-1 text-sm text-ink-soft">{g.excerpt}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {p.siblings.length ? (
        <nav aria-label="More categories" className="mt-12">
          <h2 className="mb-3 font-sans text-sm font-bold uppercase tracking-wider text-muted">More to explore</h2>
          <ul className="flex flex-wrap gap-2">
            {p.siblings.map((s) => (
              <li key={s.id}>
                <Link href={`${p.siblingBase}/${s.slug}`} className="inline-flex h-10 items-center rounded-full border border-line bg-paper px-4 text-sm hover:border-saffron hover:text-saffron-dark">
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: p.title,
          url: new URL(p.canonicalPath, p.baseUrl).toString(),
          mainEntity: {
            "@type": "ItemList",
            itemListElement: p.products.slice(0, 30).map((pr, i) => ({ "@type": "ListItem", position: i + 1, url: new URL(`/product/${pr.slug}`, p.baseUrl).toString(), name: pr.name })),
          },
        }}
      />
    </div>
  );
}
