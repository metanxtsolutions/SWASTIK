import type { Metadata } from "next";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { getDb } from "@/server/db/client";
import { siteData } from "@/server/site";
import { listCollections, listProducts, type ProductSort } from "@/server/services/catalog";
import { parseRupeesToPaise } from "@/lib/money";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { EmptyState } from "@/components/shop/empty-state";
import { Pagination } from "@/components/shop/pagination";
import { ProductGrid } from "@/components/shop/product-card";

const PAGE_SIZE = 24;
const SORTS: { value: ProductSort; label: string }[] = [
  { value: "featured", label: "Recommended" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name" },
];

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const sp = await searchParams;
  const filtered = ["category", "collection", "sort", "min", "max", "instock", "page"].some((k) => one(sp[k]));
  return {
    title: "Shop all puja flowers",
    description: "Browse all puja flowers, garlands, leaves and daily puja packs from Swastik with clear prices per unit.",
    alternates: { canonical: "/shop" },
    // Filtered and sorted views repeat the main listing, so only /shop itself is indexed.
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const db = getDb();
  const site = await siteData();
  const collections = await listCollections(db);
  const category = site.categories.find((c) => c.slug === one(sp.category));
  const collection = collections.find((c) => c.slug === one(sp.collection));
  const sort = (SORTS.find((s) => s.value === one(sp.sort))?.value ?? "featured") as ProductSort;
  const min = parseRupeesToPaise(one(sp.min)) ?? undefined;
  const max = parseRupeesToPaise(one(sp.max)) ?? undefined;
  const inStockOnly = one(sp.instock) === "1";
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const { items, total } = await listProducts(db, { categoryId: category?.id, collectionId: collection?.id, sort, minPricePaise: min, maxPricePaise: max, inStockOnly, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });

  const params = new URLSearchParams();
  for (const k of ["category", "collection", "sort", "min", "max", "instock"]) if (one(sp[k])) params.set(k, one(sp[k]));
  const hrefFor = (p: number) => {
    const q = new URLSearchParams(params);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `/shop?${s}` : "/shop";
  };
  const activeFilters = [category && `Category: ${category.name}`, collection && `Collection: ${collection.name}`, min !== undefined && `From ₹${one(sp.min)}`, max !== undefined && `Up to ₹${one(sp.max)}`, inStockOnly && "In stock only"].filter(Boolean) as string[];

  const filters = (
    <form action="/shop" className="space-y-5">
      <div>
        <label htmlFor="f-category" className="field-label">
          Category
        </label>
        <select id="f-category" name="category" defaultValue={category?.slug ?? ""} className="field-input">
          <option value="">All categories</option>
          {site.categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name} ({c.productCount})
            </option>
          ))}
        </select>
      </div>
      {collections.length ? (
        <div>
          <label htmlFor="f-collection" className="field-label">
            Festival or occasion
          </label>
          <select id="f-collection" name="collection" defaultValue={collection?.slug ?? ""} className="field-input">
            <option value="">Any</option>
            {collections.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <fieldset>
        <legend className="field-label">Price (₹)</legend>
        <div className="flex items-center gap-2">
          <input name="min" inputMode="decimal" placeholder="Min" defaultValue={one(sp.min)} className="field-input" aria-label="Minimum price in rupees" />
          <span className="text-muted">to</span>
          <input name="max" inputMode="decimal" placeholder="Max" defaultValue={one(sp.max)} className="field-input" aria-label="Maximum price in rupees" />
        </div>
      </fieldset>
      <label className="flex items-center gap-2.5 text-sm font-medium">
        <input type="checkbox" name="instock" value="1" defaultChecked={inStockOnly} className="h-5 w-5 accent-[var(--color-saffron)]" />
        In stock only
      </label>
      <div>
        <label htmlFor="f-sort" className="field-label">
          Sort by
        </label>
        <select id="f-sort" name="sort" defaultValue={sort} className="field-input">
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary flex-1">
          Apply
        </button>
        <Link href="/shop" className="btn btn-secondary">
          Clear
        </Link>
      </div>
    </form>
  );

  return (
    <div className="container-page py-6">
      <Breadcrumbs baseUrl={site.appUrl} items={[{ name: "Shop", href: "/shop" }]} />
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold sm:text-4xl">All puja flowers</h1>
          <p className="mt-1 text-ink-soft">
            {total} product{total === 1 ? "" : "s"}
            {activeFilters.length ? `, ${activeFilters.join(", ")}` : ""}
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_1fr]">
        <aside className="lg:sticky lg:top-40 lg:self-start">
          <details className="card group p-4 lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <SlidersHorizontal aria-hidden className="h-4 w-4" />
                Filter and sort
              </span>
              {activeFilters.length ? <span className="chip bg-saffron-soft text-saffron-dark">{activeFilters.length} active</span> : null}
            </summary>
            <div className="mt-4">{filters}</div>
          </details>
          <div className="card hidden p-5 lg:block">{filters}</div>
        </aside>
        <div>
          {items.length ? (
            <>
              <h2 className="sr-only">Products</h2>
              <ProductGrid products={items} priorityCount={4} />
              <Pagination page={page} total={total} pageSize={PAGE_SIZE} hrefFor={hrefFor} />
            </>
          ) : (
            <EmptyState
              title={activeFilters.length ? "No flowers match these filters" : "No flowers listed yet"}
              body={activeFilters.length ? "Try removing a filter or widening the price range." : "Our catalogue is being set up. Please check back soon or contact us."}
              action={activeFilters.length ? { label: "Clear filters", href: "/shop" } : { label: "Contact us", href: "/contact" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
