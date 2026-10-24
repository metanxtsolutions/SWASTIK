import { and, asc, desc, eq, isNull, lte, gte, or, sql } from "drizzle-orm";
import type { DbOrTx } from "../db/client";
import { articles, banners, categories, faqs, media, pages, redirects, testimonials } from "../db/schema";
import type { ImageRef } from "./catalog";

/** Public reads for owner-managed content: banners, FAQs, pages, guides, reviews and redirects. */

function imageRef(m: typeof media.$inferSelect | null, alt: string): ImageRef | null {
  return m ? { id: m.id, alt: alt || m.alt, width: m.width, height: m.height, filename: m.filename } : null;
}

export async function activeBanners(db: DbOrTx, placement: "hero" | "offer", now = new Date()) {
  const rows = await db
    .select({ b: banners, m: media })
    .from(banners)
    .leftJoin(media, eq(media.id, banners.imageId))
    .where(
      and(
        eq(banners.placement, placement),
        eq(banners.isActive, true),
        or(isNull(banners.startsAt), lte(banners.startsAt, now)),
        or(isNull(banners.endsAt), gte(banners.endsAt, now)),
      ),
    )
    .orderBy(asc(banners.sortOrder), desc(banners.createdAt));
  return rows.map((r) => ({ ...r.b, image: imageRef(r.m, r.b.imageAlt || r.b.title) }));
}

export type FaqTopic = "general" | "ordering" | "delivery" | "payment" | "bulk" | "product";

export async function publishedFaqs(db: DbOrTx, opts: { topics?: FaqTopic[]; categoryId?: string } = {}) {
  const rows = await db
    .select()
    .from(faqs)
    .where(eq(faqs.isPublished, true))
    .orderBy(asc(faqs.sortOrder), asc(faqs.createdAt));
  return rows.filter((f) => {
    if (opts.categoryId) return f.categoryId === opts.categoryId;
    if (opts.topics) return opts.topics.includes(f.topic as FaqTopic) && !f.categoryId;
    return true;
  });
}

export async function publishedPage(db: DbOrTx, slug: string) {
  const [row] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.slug, slug), eq(pages.isPublished, true)))
    .limit(1);
  return row ?? null;
}

export async function footerPages(db: DbOrTx) {
  return db
    .select({ slug: pages.slug, title: pages.title })
    .from(pages)
    .where(and(eq(pages.isPublished, true), eq(pages.showInFooter, true)))
    .orderBy(asc(pages.title));
}

export async function listPublishedPages(db: DbOrTx) {
  return db.select({ slug: pages.slug, updatedAt: pages.updatedAt }).from(pages).where(eq(pages.isPublished, true));
}

export async function listArticles(db: DbOrTx, opts: { limit?: number; categoryId?: string } = {}) {
  const rows = await db
    .select({ a: articles, m: media, categoryName: categories.name, categorySlug: categories.slug })
    .from(articles)
    .leftJoin(media, eq(media.id, articles.coverImageId))
    .leftJoin(categories, eq(categories.id, articles.relatedCategoryId))
    .where(and(eq(articles.status, "published"), opts.categoryId ? eq(articles.relatedCategoryId, opts.categoryId) : undefined))
    .orderBy(desc(articles.publishedAt))
    .limit(opts.limit ?? 50);
  return rows.map((r) => ({ ...r.a, cover: imageRef(r.m, r.a.coverAlt || r.a.title), categoryName: r.categoryName, categorySlug: r.categorySlug }));
}

export async function getArticle(db: DbOrTx, slug: string) {
  const [r] = await db
    .select({ a: articles, m: media, categoryName: categories.name, categorySlug: categories.slug, categoryId: categories.id })
    .from(articles)
    .leftJoin(media, eq(media.id, articles.coverImageId))
    .leftJoin(categories, eq(categories.id, articles.relatedCategoryId))
    .where(and(eq(articles.slug, slug), eq(articles.status, "published")))
    .limit(1);
  if (!r) return null;
  return { ...r.a, cover: imageRef(r.m, r.a.coverAlt || r.a.title), categoryName: r.categoryName, categorySlug: r.categorySlug, categoryId: r.categoryId };
}

export async function publishedTestimonials(db: DbOrTx, limit = 6) {
  return db.select().from(testimonials).where(eq(testimonials.isPublished, true)).orderBy(asc(testimonials.sortOrder), desc(testimonials.createdAt)).limit(limit);
}

export async function findRedirect(db: DbOrTx, path: string) {
  const normalized = path.length > 1 ? path.replace(/\/+$/, "") : path;
  const [row] = await db.select().from(redirects).where(eq(redirects.fromPath, normalized)).limit(1);
  if (row) await db.update(redirects).set({ hits: sql`${redirects.hits} + 1` }).where(eq(redirects.id, row.id));
  return row ?? null;
}
