import Link from "next/link";
import type { ProductCard as Card } from "@/server/services/catalog";
import { formatINR } from "@/lib/money";
import { ProductImage } from "./product-image";
import { QuickAdd } from "./quick-add";

export function ProductCard({ product, priority = false }: { product: Card; priority?: boolean }) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-float)]">
      <Link href={`/product/${product.slug}`} className="relative block aspect-square overflow-hidden bg-sand" tabIndex={-1} aria-hidden>
        <ProductImage image={product.image} name={product.name} sizes="(min-width: 1280px) 280px, (min-width: 768px) 30vw, 48vw" priority={priority} className="transition duration-300 group-hover:scale-[1.03]" />
        {!product.inStock ? <span className="chip absolute left-2 top-2 bg-paper/95 text-muted">Out of stock</span> : product.compareAtPaise ? <span className="chip absolute left-2 top-2 bg-kumkum text-white">Offer</span> : product.isBestseller ? <span className="chip absolute left-2 top-2 bg-marigold-soft text-saffron-dark">Bestseller</span> : null}
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
        {product.categoryName ? <p className="text-xs font-medium text-muted">{product.categoryName}</p> : null}
        <h3 className="font-sans text-[0.95rem] font-semibold leading-snug text-ink sm:text-base">
          <Link href={`/product/${product.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {product.name}
          </Link>
        </h3>
        <p className="mt-auto pt-1 text-sm">
          {product.variantCount > 1 ? <span className="text-muted">From </span> : null}
          <span className="text-base font-bold text-ink">{formatINR(product.pricePaise)}</span> {product.compareAtPaise ? <s className="text-muted">{formatINR(product.compareAtPaise)}</s> : null}
          <span className="block text-xs text-muted">{product.unitText}</span>
        </p>
        <div className="relative z-10 pt-2">
          <QuickAdd productSlug={product.slug} productName={product.name} variantId={product.defaultVariantId} minQty={product.defaultVariantMinQty} inStock={product.inStock} variantCount={product.variantCount} />
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products, priorityCount = 0 }: { products: Card[]; priorityCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}

/** Horizontal scroller on phones, grid on larger screens. */
export function ProductRail({ products }: { products: Card[] }) {
  return (
    <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-4">
      {products.map((p) => (
        <li key={p.id} className="w-[46%] shrink-0 snap-start sm:w-auto">
          <ProductCard product={p} />
        </li>
      ))}
    </ul>
  );
}
