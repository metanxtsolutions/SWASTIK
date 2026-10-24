import Link from "next/link";
import type { CategoryView } from "@/server/services/catalog";
import { ProductImage } from "./product-image";

export function CategoryTiles({ categories, basePath = "/category" }: { categories: Pick<CategoryView, "id" | "slug" | "name" | "image" | "productCount">[]; basePath?: string }) {
  return (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
      {categories.map((c) => (
        <li key={c.id}>
          <Link href={`${basePath}/${c.slug}`} className="group block text-center">
            <span className="relative mx-auto block aspect-square overflow-hidden rounded-2xl border border-line bg-sand shadow-[var(--shadow-card)]">
              <ProductImage image={c.image} name={c.name} sizes="(min-width: 1024px) 180px, 30vw" className="transition duration-300 group-hover:scale-105" />
            </span>
            <span className="mt-2 block text-sm font-semibold leading-tight text-ink group-hover:text-saffron-dark">{c.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
