import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/server/db/client";
import { siteData } from "@/server/site";
import { listProducts } from "@/server/services/catalog";
import { EmptyState } from "@/components/shop/empty-state";
import { ProductGrid } from "@/components/shop/product-card";

export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const site = await siteData();
  const { items, total } = q ? await listProducts(getDb(), { q, limit: 48 }) : { items: [], total: 0 };
  return (
    <div className="container-page py-6">
      <h1 className="text-3xl font-semibold">{q ? <>Results for “{q}”</> : "Search"}</h1>
      <form action="/search" role="search" className="mt-4 flex max-w-xl gap-2">
        <label htmlFor="search-page" className="sr-only">
          Search flowers
        </label>
        <input id="search-page" name="q" type="search" defaultValue={q} placeholder="Search flowers, garlands, leaves" className="field-input" />
        <button className="btn btn-primary" type="submit">
          Search
        </button>
      </form>
      {q ? <p className="mt-3 text-sm text-muted">{total} result{total === 1 ? "" : "s"}</p> : null}
      <div className="mt-5">
        {items.length ? (
          <>
            <h2 className="sr-only">Products</h2>
            <ProductGrid products={items} />
          </>
        ) : q ? (
          <EmptyState
            title="No flowers found"
            body={
              <>
                <p>Try a different word, such as “marigold”, “garland” or “bel”.</p>
                {site.categories.length ? (
                  <ul className="mt-4 flex flex-wrap justify-center gap-2">
                    {site.categories.slice(0, 6).map((c) => (
                      <li key={c.id}>
                        <Link href={`/category/${c.slug}`} className="inline-flex h-9 items-center rounded-full border border-line px-3 text-sm hover:border-saffron">
                          {c.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            }
            action={{ label: "Request flowers in bulk", href: "/bulk-orders" }}
          />
        ) : null}
      </div>
    </div>
  );
}
