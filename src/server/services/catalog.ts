import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { DbOrTx } from "../db/client";
import { categories, collections, media, productCollections, productImages, products, productVariants, productZones } from "../db/schema";
import { perUnit, type SaleUnit } from "@/lib/units";
import { todayInIndia } from "@/lib/dates";

/**
 * Public catalogue queries. Only published products in visible categories are
 * returned, so nothing that has not been configured is ever offered for sale.
 */

export interface ImageRef {
  id: string;
  alt: string;
  width: number | null;
  height: number | null;
  filename: string;
}

export interface ProductCard {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  categoryName: string | null;
  categorySlug: string | null;
  image: ImageRef | null;
  pricePaise: number; // effective price of the lowest-priced variant
  compareAtPaise: number | null; // its regular price when on sale
  unitText: string; // "per bunch"
  variantCount: number;
  defaultVariantId: string | null;
  defaultVariantMinQty: number;
  inStock: boolean;
  isBestseller: boolean;
  isFeatured: boolean;
}

export interface VariantView {
  id: string;
  label: string;
  sku: string;
  unit: SaleUnit;
  unitText: string;
  pricePaise: number;
  regularPricePaise: number;
  onSale: boolean;
  available: boolean;
  lowStock: number | null; // remaining units when low, for "Only 3 left"
  minOrderQty: number;
  maxOrderQty: number | null;
}

export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  usageInfo: string;
  careInfo: string;
  unit: SaleUnit;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  isBestseller: boolean;
  category: { id: string; name: string; slug: string } | null;
  collections: { name: string; slug: string }[];
  images: ImageRef[];
  variants: VariantView[];
  zoneIds: string[]; // empty: sold in every active zone
  updatedAt: Date;
}

export function mediaUrl(image: Pick<ImageRef, "id" | "filename">): string {
  return `/api/media/${image.id}/${image.filename}`;
}

const effectivePrice = sql<number>`COALESCE(${productVariants.salePricePaise}, ${productVariants.pricePaise})`;

/** Lowest effective price among active variants, as a correlated subquery. */
const minPriceSql = sql<number>`(SELECT MIN(COALESCE(v.sale_price_paise, v.price_paise)) FROM product_variants v WHERE v.product_id = ${products.id} AND v.is_active)`;
const inStockSql = sql<boolean>`EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = ${products.id} AND v.is_active AND (NOT v.track_inventory OR v.stock_quantity >= v.min_order_qty))`;

function publicProductWhere(): SQL {
  return and(
    eq(products.status, "published"),
    sql`EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = ${products.id} AND v.is_active)`,
    sql`(${products.categoryId} IS NULL OR EXISTS (SELECT 1 FROM categories c WHERE c.id = ${products.categoryId} AND c.is_visible))`,
  )!;
}

export function variantAvailable(v: { isActive: boolean; trackInventory: boolean; stockQuantity: number; minOrderQty: number }): boolean {
  return v.isActive && (!v.trackInventory || v.stockQuantity >= v.minOrderQty);
}

function toImageRef(m: { id: string; alt: string; width: number | null; height: number | null; filename: string }, alt?: string): ImageRef {
  return { id: m.id, alt: alt || m.alt, width: m.width, height: m.height, filename: m.filename };
}

async function hydrateCards(db: DbOrTx, rows: (typeof products.$inferSelect & { categoryName: string | null; categorySlug: string | null })[]): Promise<ProductCard[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [variants, images] = await Promise.all([
    db
      .select()
      .from(productVariants)
      .where(and(inArray(productVariants.productId, ids), eq(productVariants.isActive, true)))
      .orderBy(asc(productVariants.sortOrder), asc(effectivePrice)),
    db
      .select({ productId: productImages.productId, alt: productImages.alt, sortOrder: productImages.sortOrder, m: media })
      .from(productImages)
      .innerJoin(media, eq(media.id, productImages.mediaId))
      .where(inArray(productImages.productId, ids))
      .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt)),
  ]);
  return rows.map((p) => {
    const vs = variants.filter((v) => v.productId === p.id);
    const available = vs.filter(variantAvailable);
    const pool = available.length ? available : vs;
    const cheapest = pool.reduce<(typeof vs)[number] | null>((best, v) => (!best || (v.salePricePaise ?? v.pricePaise) < (best.salePricePaise ?? best.pricePaise) ? v : best), null);
    const img = images.find((i) => i.productId === p.id);
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      shortDescription: p.shortDescription,
      categoryName: p.categoryName,
      categorySlug: p.categorySlug,
      image: img ? toImageRef(img.m, img.alt || p.name) : null,
      pricePaise: cheapest ? (cheapest.salePricePaise ?? cheapest.pricePaise) : 0,
      compareAtPaise: cheapest?.salePricePaise ? cheapest.pricePaise : null,
      unitText: cheapest ? perUnit(cheapest.unit, cheapest.label) : "",
      variantCount: vs.length,
      defaultVariantId: vs.length === 1 && available.length === 1 ? vs[0].id : null,
      defaultVariantMinQty: vs.length === 1 ? vs[0].minOrderQty : 1,
      inStock: available.length > 0,
      isBestseller: p.isBestseller,
      isFeatured: p.isFeatured,
    };
  });
}

function cardSelect() {
  return { ...getProductColumns(), categoryName: categories.name, categorySlug: categories.slug };
}

function getProductColumns() {
  const { id, name, slug, categoryId, shortDescription, description, usageInfo, careInfo, unit, tags, status, isFeatured, isBestseller, sortOrder, seoTitle, seoDescription, publishedAt, createdAt, updatedAt } =
    products;
  return { id, name, slug, categoryId, shortDescription, description, usageInfo, careInfo, unit, tags, status, isFeatured, isBestseller, sortOrder, seoTitle, seoDescription, publishedAt, createdAt, updatedAt };
}

export type ProductSort = "featured" | "price_asc" | "price_desc" | "newest" | "name";

export interface ProductQuery {
  categoryId?: string;
  collectionId?: string;
  q?: string;
  inStockOnly?: boolean;
  minPricePaise?: number;
  maxPricePaise?: number;
  ids?: string[];
  featured?: boolean;
  bestseller?: boolean;
  sort?: ProductSort;
  limit?: number;
  offset?: number;
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listProducts(db: DbOrTx, q: ProductQuery = {}): Promise<{ items: ProductCard[]; total: number }> {
  const conditions: SQL[] = [publicProductWhere()];
  if (q.categoryId) conditions.push(eq(products.categoryId, q.categoryId));
  if (q.collectionId) conditions.push(sql`EXISTS (SELECT 1 FROM product_collections pc WHERE pc.product_id = ${products.id} AND pc.collection_id = ${q.collectionId})`);
  if (q.ids) conditions.push(q.ids.length ? inArray(products.id, q.ids) : sql`false`);
  if (q.featured) conditions.push(eq(products.isFeatured, true));
  if (q.bestseller) conditions.push(eq(products.isBestseller, true));
  if (q.inStockOnly) conditions.push(inStockSql);
  if (q.minPricePaise !== undefined) conditions.push(sql`${minPriceSql} >= ${q.minPricePaise}`);
  if (q.maxPricePaise !== undefined) conditions.push(sql`${minPriceSql} <= ${q.maxPricePaise}`);
  const term = q.q?.trim().slice(0, 80);
  if (term) {
    const words = term.split(/\s+/).filter(Boolean).slice(0, 5);
    for (const w of words) {
      const like = `%${escapeLike(w)}%`;
      conditions.push(
        sql`(${products.name} ILIKE ${like} OR ${products.shortDescription} ILIKE ${like} OR array_to_string(${products.tags}, ' ') ILIKE ${like} OR ${categories.name} ILIKE ${like} OR EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = ${products.id} AND v.label ILIKE ${like}))`,
      );
    }
  }
  const where = and(...conditions);
  const order =
    q.sort === "price_asc"
      ? [asc(minPriceSql), asc(products.name)]
      : q.sort === "price_desc"
        ? [desc(minPriceSql), asc(products.name)]
        : q.sort === "newest"
          ? [desc(products.publishedAt), desc(products.createdAt)]
          : q.sort === "name"
            ? [asc(products.name)]
            : term
              ? [sql`(${products.name} ILIKE ${`${escapeLike(term)}%`}) DESC`, desc(inStockSql), asc(products.name)]
              : [desc(inStockSql), desc(products.isFeatured), asc(products.sortOrder), asc(products.name)];
  const [rows, countRows] = await Promise.all([
    db
      .select(cardSelect())
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .where(where)
      .orderBy(...order)
      .limit(q.limit ?? 24)
      .offset(q.offset ?? 0),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .where(where),
  ]);
  let items = await hydrateCards(db, rows);
  if (q.ids && !q.sort) items = q.ids.map((id) => items.find((i) => i.id === id)).filter((i): i is ProductCard => !!i);
  return { items, total: countRows[0]?.n ?? 0 };
}

export interface CategoryView {
  id: string;
  name: string;
  slug: string;
  summary: string;
  intro: string;
  seoTitle: string;
  seoDescription: string;
  image: ImageRef | null;
  productCount: number;
  updatedAt: Date;
}

/** Visible categories that have at least one published product (empty categories are not shown or indexed). */
export async function listCategories(db: DbOrTx, opts: { includeEmpty?: boolean } = {}): Promise<CategoryView[]> {
  const rows = await db
    .select({
      c: categories,
      m: media,
      productCount: sql<number>`(SELECT count(*)::int FROM products p WHERE p.category_id = ${categories.id} AND p.status = 'published' AND EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.is_active))`,
    })
    .from(categories)
    .leftJoin(media, eq(media.id, categories.imageId))
    .where(eq(categories.isVisible, true))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  return rows
    .filter((r) => opts.includeEmpty || r.productCount > 0)
    .map((r) => ({
      id: r.c.id,
      name: r.c.name,
      slug: r.c.slug,
      summary: r.c.summary,
      intro: r.c.intro,
      seoTitle: r.c.seoTitle,
      seoDescription: r.c.seoDescription,
      image: r.m ? toImageRef(r.m, r.c.name) : null,
      productCount: r.productCount,
      updatedAt: r.c.updatedAt,
    }));
}

export async function getCategory(db: DbOrTx, slug: string): Promise<CategoryView | null> {
  const all = await listCategories(db);
  return all.find((c) => c.slug === slug) ?? null;
}

export interface CollectionView extends CategoryView {
  startsOn: string | null;
  endsOn: string | null;
}

/** Visible collections within their date window that have at least one published product. */
export async function listCollections(db: DbOrTx): Promise<CollectionView[]> {
  const today = todayInIndia();
  const rows = await db
    .select({
      c: collections,
      m: media,
      productCount: sql<number>`(SELECT count(*)::int FROM product_collections pc JOIN products p ON p.id = pc.product_id WHERE pc.collection_id = ${collections.id} AND p.status = 'published' AND EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.is_active))`,
    })
    .from(collections)
    .leftJoin(media, eq(media.id, collections.imageId))
    .where(and(eq(collections.isVisible, true), sql`(${collections.startsOn} IS NULL OR ${collections.startsOn} <= ${today})`, sql`(${collections.endsOn} IS NULL OR ${collections.endsOn} >= ${today})`))
    .orderBy(asc(collections.sortOrder), asc(collections.name));
  return rows
    .filter((r) => r.productCount > 0)
    .map((r) => ({
      id: r.c.id,
      name: r.c.name,
      slug: r.c.slug,
      summary: r.c.summary,
      intro: r.c.intro,
      seoTitle: r.c.seoTitle,
      seoDescription: r.c.seoDescription,
      image: r.m ? toImageRef(r.m, r.c.name) : null,
      productCount: r.productCount,
      updatedAt: r.c.updatedAt,
      startsOn: r.c.startsOn,
      endsOn: r.c.endsOn,
    }));
}

export async function getCollection(db: DbOrTx, slug: string): Promise<CollectionView | null> {
  return (await listCollections(db)).find((c) => c.slug === slug) ?? null;
}

export async function getProduct(db: DbOrTx, slug: string, opts: { lowStockThreshold?: number; includeUnpublished?: boolean } = {}): Promise<ProductDetail | null> {
  const [row] = await db
    .select(cardSelect())
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(opts.includeUnpublished ? eq(products.slug, slug) : and(eq(products.slug, slug), publicProductWhere()))
    .limit(1);
  if (!row) return null;
  const [variants, images, cols, zones] = await Promise.all([
    db
      .select()
      .from(productVariants)
      .where(and(eq(productVariants.productId, row.id), eq(productVariants.isActive, true)))
      .orderBy(asc(productVariants.sortOrder), asc(effectivePrice)),
    db
      .select({ alt: productImages.alt, m: media })
      .from(productImages)
      .innerJoin(media, eq(media.id, productImages.mediaId))
      .where(eq(productImages.productId, row.id))
      .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt)),
    db
      .select({ name: collections.name, slug: collections.slug })
      .from(productCollections)
      .innerJoin(collections, eq(collections.id, productCollections.collectionId))
      .where(and(eq(productCollections.productId, row.id), eq(collections.isVisible, true))),
    db.select({ zoneId: productZones.zoneId }).from(productZones).where(eq(productZones.productId, row.id)),
  ]);
  const threshold = opts.lowStockThreshold ?? 5;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: row.shortDescription,
    description: row.description,
    usageInfo: row.usageInfo,
    careInfo: row.careInfo,
    unit: row.unit,
    tags: row.tags,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    isBestseller: row.isBestseller,
    category: row.categoryId && row.categoryName && row.categorySlug ? { id: row.categoryId, name: row.categoryName, slug: row.categorySlug } : null,
    collections: cols,
    images: images.map((i, idx) => toImageRef(i.m, i.alt || (idx === 0 ? row.name : `${row.name}, photo ${idx + 1}`))),
    variants: variants.map((v) => {
      const available = variantAvailable(v);
      return {
        id: v.id,
        label: v.label,
        sku: v.sku,
        unit: v.unit,
        unitText: perUnit(v.unit, v.label),
        pricePaise: v.salePricePaise ?? v.pricePaise,
        regularPricePaise: v.pricePaise,
        onSale: v.salePricePaise !== null,
        available,
        lowStock: available && v.trackInventory && v.stockQuantity <= threshold ? v.stockQuantity : null,
        minOrderQty: v.minOrderQty,
        maxOrderQty: v.trackInventory ? Math.min(v.maxOrderQty ?? Number.MAX_SAFE_INTEGER, v.stockQuantity) : v.maxOrderQty,
      };
    }),
    zoneIds: zones.map((z) => z.zoneId),
    updatedAt: row.updatedAt,
  };
}

export async function relatedProducts(db: DbOrTx, product: Pick<ProductDetail, "id" | "category" | "tags">, limit = 4): Promise<ProductCard[]> {
  const conditions: SQL[] = [publicProductWhere(), sql`${products.id} <> ${product.id}`];
  const tagOverlap = product.tags.length
    ? sql`${products.tags} && ARRAY[${sql.join(
        product.tags.map((t) => sql`${t}`),
        sql`, `,
      )}]::text[]`
    : sql`false`;
  const sameCategory = product.category ? sql`${products.categoryId} = ${product.category.id}` : sql`false`;
  // Same category first, then shared tags, then anything else in stock.
  const rows = await db
    .select(cardSelect())
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(...conditions))
    .orderBy(sql`(${sameCategory}) DESC`, sql`(${tagOverlap}) DESC`, desc(inStockSql), desc(products.isBestseller), asc(products.name))
    .limit(limit);
  return hydrateCards(db, rows);
}

/**
 * Bestsellers from actual sales: units sold in the last 90 days on orders that
 * were not cancelled. Products the owner marks as bestsellers fill the list when
 * there is not enough sales history yet.
 */
export async function bestsellers(db: DbOrTx, limit = 8): Promise<ProductCard[]> {
  const sold = await db.execute<{ product_id: string; units: number }>(sql`
    SELECT oi.product_id, SUM(oi.quantity)::int AS units
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.created_at > now() - interval '90 days'
      AND o.status NOT IN ('cancelled', 'pending_payment')
      AND oi.product_id IS NOT NULL
    GROUP BY oi.product_id
    ORDER BY units DESC
    LIMIT ${limit}`);
  const soldIds = sold.rows.map((r) => r.product_id);
  const fromSales = soldIds.length ? (await listProducts(db, { ids: soldIds, limit })).items : [];
  if (fromSales.length >= limit) return fromSales.slice(0, limit);
  const flagged = (await listProducts(db, { bestseller: true, limit })).items.filter((p) => !soldIds.includes(p.id));
  return [...fromSales, ...flagged].slice(0, limit);
}

/** Published slugs for the sitemap. */
export async function sitemapProducts(db: DbOrTx): Promise<{ slug: string; updatedAt: Date }[]> {
  return db.select({ slug: products.slug, updatedAt: products.updatedAt }).from(products).leftJoin(categories, eq(categories.id, products.categoryId)).where(publicProductWhere());
}
