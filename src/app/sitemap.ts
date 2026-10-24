import type { MetadataRoute } from "next";
import { getDb } from "@/server/db/client";
import { getEnv } from "@/server/env";
import { listCategories, listCollections, sitemapProducts } from "@/server/services/catalog";
import { listArticles, listPublishedPages } from "@/server/services/content";
import { listLandingZones } from "@/server/services/delivery";

export const revalidate = 3600;

/** Only pages with real content: empty categories and unpublished items are left out. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = getDb();
  const base = getEnv().APP_URL;
  const [categories, collections, products, articles, pages, zones] = await Promise.all([listCategories(db), listCollections(db), sitemapProducts(db), listArticles(db, { limit: 500 }), listPublishedPages(db), listLandingZones(db)]);
  const url = (path: string) => new URL(path, base).toString();
  return [
    { url: url("/"), changeFrequency: "daily", priority: 1 },
    { url: url("/shop"), changeFrequency: "daily", priority: 0.9 },
    { url: url("/bulk-orders"), changeFrequency: "monthly", priority: 0.8 },
    { url: url("/delivery"), changeFrequency: "weekly", priority: 0.6 },
    { url: url("/faq"), changeFrequency: "monthly", priority: 0.5 },
    { url: url("/contact"), changeFrequency: "monthly", priority: 0.5 },
    ...(articles.length ? [{ url: url("/guides"), changeFrequency: "weekly" as const, priority: 0.6 }] : []),
    ...categories.map((c) => ({ url: url(`/category/${c.slug}`), lastModified: c.updatedAt, changeFrequency: "daily" as const, priority: 0.8 })),
    ...collections.map((c) => ({ url: url(`/collections/${c.slug}`), lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...products.map((p) => ({ url: url(`/product/${p.slug}`), lastModified: p.updatedAt, changeFrequency: "daily" as const, priority: 0.7 })),
    ...articles.map((a) => ({ url: url(`/guides/${a.slug}`), lastModified: a.updatedAt, changeFrequency: "monthly" as const, priority: 0.5 })),
    ...pages.map((p) => ({ url: url(`/${p.slug}`), lastModified: p.updatedAt, changeFrequency: "yearly" as const, priority: 0.3 })),
    ...zones.map((z) => ({ url: url(`/delivery-areas/${z.slug}`), lastModified: z.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
