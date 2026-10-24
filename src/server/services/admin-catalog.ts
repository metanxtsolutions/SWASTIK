import { and, asc, desc, eq, ilike, inArray, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Database, DbOrTx } from "../db/client";
import { categories, collections, media, orderItems, productCollections, productImages, products, productVariants, productZones, stockMovements } from "../db/schema";
import { ConflictError, NotFoundError, ValidationError } from "../errors";
import { putObject, validateImageUpload } from "../storage";
import { parseRupeesToPaise } from "@/lib/money";
import { slugify, SLUG_PATTERN } from "@/lib/slug";
import { SALE_UNITS } from "@/lib/units";
import { fieldErrorsFromZod } from "./orders";

/** Catalogue management for the admin panel. Every function validates its own input. */

const slugField = z
  .string()
  .trim()
  .max(80)
  .transform((v) => v.toLowerCase())
  .refine((v) => v === "" || SLUG_PATTERN.test(v), "Use lowercase letters, numbers and hyphens only");

const uuidOrNull = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || z.string().uuid().safeParse(v).success, "Invalid selection");

const money = (label: string, opts: { optional?: boolean } = {}) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((v, ctx) => {
      if (v === undefined || v === null || String(v).trim() === "") {
        if (!opts.optional) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Enter the ${label}` });
        return null;
      }
      const p = parseRupeesToPaise(v);
      if (p === null || p < 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Enter the ${label} in rupees, e.g. 120 or 99.50` });
      return p;
    });

const intField = (min: number, max: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((v) => (v === undefined || v === null || String(v).trim() === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= min && v <= max), `Enter a whole number from ${min} to ${max}`);

export const variantInputSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  label: z.string().trim().max(60).default(""),
  sku: z
    .string()
    .trim()
    .min(2, "Enter a SKU")
    .max(40)
    .transform((v) => v.toUpperCase())
    .refine((v) => /^[A-Z0-9][A-Z0-9-_.]*$/.test(v), "Use letters, numbers and hyphens"),
  unit: z.enum(SALE_UNITS),
  price: money("price"),
  salePrice: money("sale price", { optional: true }),
  trackInventory: z.boolean().default(true),
  stockQuantity: intField(0, 1_000_000).transform((v) => v ?? 0),
  minOrderQty: intField(1, 10_000).transform((v) => v ?? 1),
  maxOrderQty: intField(1, 100_000),
  isActive: z.boolean().default(true),
});

export const productInputSchema = z
  .object({
    name: z.string().trim().min(2, "Enter a product name").max(120),
    slug: slugField,
    categoryId: uuidOrNull,
    shortDescription: z.string().trim().max(200).default(""),
    description: z.string().trim().max(5000).default(""),
    usageInfo: z.string().trim().max(2000).default(""),
    careInfo: z.string().trim().max(2000).default(""),
    unit: z.enum(SALE_UNITS),
    tags: z
      .string()
      .default("")
      .transform((v) =>
        [
          ...new Set(
            v
              .split(",")
              .map((t) => t.trim().toLowerCase())
              .filter(Boolean),
          ),
        ].slice(0, 20),
      ),
    status: z.enum(["draft", "published", "archived"]),
    isFeatured: z.boolean().default(false),
    isBestseller: z.boolean().default(false),
    sortOrder: intField(-1000, 1000).transform((v) => v ?? 0),
    seoTitle: z.string().trim().max(70, "Keep the SEO title under 70 characters").default(""),
    seoDescription: z.string().trim().max(170, "Keep the SEO description under 170 characters").default(""),
    collectionIds: z.array(z.string().uuid()).default([]),
    zoneIds: z.array(z.string().uuid()).default([]),
    variants: z.array(variantInputSchema).min(1, "Add at least one option with a price").max(20),
  })
  .superRefine((p, ctx) => {
    const skus = new Set<string>();
    p.variants.forEach((v, i) => {
      if (skus.has(v.sku)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["variants", i, "sku"], message: "Each option needs its own SKU" });
      skus.add(v.sku);
      if (v.price !== null && v.price <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["variants", i, "price"], message: "Price must be more than zero" });
      if (v.salePrice !== null && v.price !== null && v.salePrice >= v.price) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["variants", i, "salePrice"], message: "Sale price must be lower than the price" });
      if (v.maxOrderQty !== null && v.maxOrderQty < v.minOrderQty) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["variants", i, "maxOrderQty"], message: "Maximum must be at least the minimum" });
    });
    if (p.variants.length > 1 && p.variants.some((v) => !v.label)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["variants"], message: "When a product has several options, give each one a label (e.g. 250 g, 500 g)" });
    }
    if (p.status === "published") {
      if (!p.categoryId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["categoryId"], message: "Choose a category before publishing" });
      if (p.description.length < 30) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["description"], message: "Write a description of at least 30 characters before publishing" });
      if (!p.variants.some((v) => v.isActive)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["variants"], message: "At least one option must be active to publish" });
    }
  });

export type ProductInput = z.input<typeof productInputSchema>;

function uniqueViolation(e: unknown): string | null {
  const err = e as { code?: string; constraint?: string };
  return err.code === "23505" ? (err.constraint ?? "unique") : null;
}

export async function saveProduct(db: Database, id: string | null, raw: unknown): Promise<{ id: string; slug: string }> {
  const parsed = productInputSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  const p = parsed.data;
  const slug = p.slug || slugify(p.name);
  if (!slug) throw new ValidationError("Enter a URL slug.", { slug: "Required" });
  try {
    return await db.transaction(async (tx) => {
      const now = new Date();
      const values = {
        name: p.name,
        slug,
        categoryId: p.categoryId,
        shortDescription: p.shortDescription,
        description: p.description,
        usageInfo: p.usageInfo,
        careInfo: p.careInfo,
        unit: p.unit,
        tags: p.tags,
        status: p.status,
        isFeatured: p.isFeatured,
        isBestseller: p.isBestseller,
        sortOrder: p.sortOrder,
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
        updatedAt: now,
      };
      let productId = id;
      if (productId) {
        const [existing] = await tx.select().from(products).where(eq(products.id, productId));
        if (!existing) throw new NotFoundError("Product not found");
        await tx
          .update(products)
          .set({ ...values, publishedAt: p.status === "published" ? (existing.publishedAt ?? now) : existing.publishedAt })
          .where(eq(products.id, productId));
      } else {
        const [created] = await tx
          .insert(products)
          .values({ ...values, publishedAt: p.status === "published" ? now : null })
          .returning({ id: products.id });
        productId = created.id;
      }

      const keepIds = p.variants.map((v) => v.id).filter((v): v is string => !!v);
      if (keepIds.length) {
        const owned = await tx.select({ id: productVariants.id }).from(productVariants).where(and(inArray(productVariants.id, keepIds), eq(productVariants.productId, productId)));
        if (owned.length !== keepIds.length) throw new ValidationError("An option does not belong to this product. Reload the page and try again.");
      }
      await tx.delete(productVariants).where(and(eq(productVariants.productId, productId), keepIds.length ? notInArray(productVariants.id, keepIds) : undefined));
      for (const [i, v] of p.variants.entries()) {
        const row = {
          productId,
          label: v.label,
          sku: v.sku,
          unit: v.unit,
          pricePaise: v.price!,
          salePricePaise: v.salePrice,
          trackInventory: v.trackInventory,
          minOrderQty: v.minOrderQty,
          maxOrderQty: v.maxOrderQty,
          isActive: v.isActive,
          sortOrder: i,
          updatedAt: now,
        };
        if (v.id) {
          const [before] = await tx.select({ stock: productVariants.stockQuantity }).from(productVariants).where(eq(productVariants.id, v.id));
          await tx
            .update(productVariants)
            .set({ ...row, stockQuantity: v.stockQuantity })
            .where(eq(productVariants.id, v.id));
          if (before && before.stock !== v.stockQuantity) {
            await tx.insert(stockMovements).values({ variantId: v.id, delta: v.stockQuantity - before.stock, reason: "admin_adjustment", note: "Edited on the product page" });
          }
        } else {
          const [created] = await tx
            .insert(productVariants)
            .values({ ...row, stockQuantity: v.stockQuantity })
            .returning({ id: productVariants.id });
          if (v.stockQuantity) await tx.insert(stockMovements).values({ variantId: created.id, delta: v.stockQuantity, reason: "admin_adjustment", note: "Opening stock" });
        }
      }

      await tx.delete(productCollections).where(eq(productCollections.productId, productId));
      if (p.collectionIds.length) await tx.insert(productCollections).values(p.collectionIds.map((collectionId) => ({ productId: productId!, collectionId })));
      await tx.delete(productZones).where(eq(productZones.productId, productId));
      if (p.zoneIds.length) await tx.insert(productZones).values(p.zoneIds.map((zoneId) => ({ productId: productId!, zoneId })));
      return { id: productId, slug };
    });
  } catch (e) {
    const c = uniqueViolation(e);
    if (c?.includes("slug")) throw new ValidationError("Another product already uses this URL slug.", { slug: "Already in use" });
    if (c?.includes("sku")) throw new ValidationError("Another product already uses one of these SKUs.", { variants: "SKU already in use" });
    throw e;
  }
}

export async function deleteProduct(db: Database, id: string): Promise<"deleted" | "archived"> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(orderItems).where(eq(orderItems.productId, id));
  if (n > 0) {
    // Ordered products are archived so order history and reports keep their links.
    await db.update(products).set({ status: "archived", updatedAt: new Date() }).where(eq(products.id, id));
    return "archived";
  }
  await db.delete(products).where(eq(products.id, id));
  return "deleted";
}

export async function listAdminProducts(db: DbOrTx, f: { q?: string; status?: string; categoryId?: string; page?: number }) {
  const c: SQL[] = [];
  if (f.status && ["draft", "published", "archived"].includes(f.status)) c.push(eq(products.status, f.status as "draft"));
  else c.push(ne(products.status, "archived"));
  if (f.categoryId) c.push(eq(products.categoryId, f.categoryId));
  if (f.q?.trim()) {
    const like = `%${f.q.trim().replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    c.push(or(ilike(products.name, like), ilike(products.slug, like), sql`EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = ${products.id} AND v.sku ILIKE ${like})`)!);
  }
  const where = and(...c);
  const page = Math.max(1, f.page ?? 1);
  const rows = await db
    .select({
      p: products,
      categoryName: categories.name,
      variantCount: sql<number>`(SELECT count(*)::int FROM product_variants v WHERE v.product_id = ${products.id})`,
      minPrice: sql<number | null>`(SELECT MIN(COALESCE(v.sale_price_paise, v.price_paise)) FROM product_variants v WHERE v.product_id = ${products.id} AND v.is_active)`,
      totalStock: sql<number | null>`(SELECT SUM(v.stock_quantity)::int FROM product_variants v WHERE v.product_id = ${products.id} AND v.track_inventory AND v.is_active)`,
      untracked: sql<boolean>`EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = ${products.id} AND NOT v.track_inventory AND v.is_active)`,
      imageId: sql<string | null>`(SELECT pi.media_id FROM product_images pi WHERE pi.product_id = ${products.id} ORDER BY pi.sort_order, pi.created_at LIMIT 1)`,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(where)
    .orderBy(asc(products.sortOrder), asc(products.name))
    .limit(50)
    .offset((page - 1) * 50);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(products).where(where);
  return { rows, total: n, page };
}

export async function getAdminProduct(db: DbOrTx, id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const [p] = await db.select().from(products).where(eq(products.id, id));
  if (!p) return null;
  const [variants, images, cols, zones] = await Promise.all([
    db.select().from(productVariants).where(eq(productVariants.productId, id)).orderBy(asc(productVariants.sortOrder)),
    db
      .select({ id: productImages.id, alt: productImages.alt, sortOrder: productImages.sortOrder, m: media })
      .from(productImages)
      .innerJoin(media, eq(media.id, productImages.mediaId))
      .where(eq(productImages.productId, id))
      .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt)),
    db.select({ id: productCollections.collectionId }).from(productCollections).where(eq(productCollections.productId, id)),
    db.select({ id: productZones.zoneId }).from(productZones).where(eq(productZones.productId, id)),
  ]);
  return { product: p, variants, images, collectionIds: cols.map((c) => c.id), zoneIds: zones.map((z) => z.id) };
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

export async function uploadImage(db: DbOrTx, file: File, opts: { alt: string; nameHint: string; minSide?: number }) {
  const img = await validateImageUpload(file, { minSide: opts.minSide });
  const base = slugify(opts.nameHint) || img.filename.replace(/\.[^.]+$/, "");
  const ext = img.filename.split(".").pop();
  const filename = `${base}.${ext}`;
  const key = `images/${img.sha256.slice(0, 2)}/${img.sha256}.${ext}`;
  await putObject(key, img.bytes, img.mime);
  const [row] = await db
    .insert(media)
    .values({ storageKey: key, filename, contentType: img.mime, size: img.bytes.length, width: img.width, height: img.height, sha256: img.sha256, alt: opts.alt.trim().slice(0, 200) })
    .returning();
  return row;
}

export async function addProductImages(db: Database, productId: string, files: File[], alt: string) {
  const [p] = await db.select().from(products).where(eq(products.id, productId));
  if (!p) throw new NotFoundError("Product not found");
  const valid = files.filter((f) => f && f.size > 0);
  if (!valid.length) throw new ValidationError("Choose at least one image.");
  if (valid.length > 8) throw new ValidationError("Upload up to 8 images at a time.");
  const [{ max }] = await db.select({ max: sql<number>`COALESCE(MAX(sort_order), -1)::int` }).from(productImages).where(eq(productImages.productId, productId));
  let order = max;
  for (const file of valid) {
    const m = await uploadImage(db, file, { alt: alt || p.name, nameHint: p.slug });
    order += 1;
    await db.insert(productImages).values({ productId, mediaId: m.id, alt: alt.trim().slice(0, 200), sortOrder: order });
  }
}

export async function updateProductImage(db: Database, productId: string, imageId: string, action: { alt?: string; makeMain?: boolean; remove?: boolean }) {
  const [img] = await db
    .select()
    .from(productImages)
    .where(and(eq(productImages.id, imageId), eq(productImages.productId, productId)));
  if (!img) throw new NotFoundError("Image not found");
  if (action.remove) {
    await db.delete(productImages).where(eq(productImages.id, imageId));
    return;
  }
  if (action.alt !== undefined) await db.update(productImages).set({ alt: action.alt.trim().slice(0, 200) }).where(eq(productImages.id, imageId));
  if (action.makeMain) {
    const [{ min }] = await db.select({ min: sql<number>`COALESCE(MIN(sort_order), 0)::int` }).from(productImages).where(eq(productImages.productId, productId));
    await db.update(productImages).set({ sortOrder: min - 1 }).where(eq(productImages.id, imageId));
  }
}

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

export async function setStock(db: Database, variantId: string, quantity: number, note: string): Promise<void> {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1_000_000) throw new ValidationError("Enter a stock quantity of 0 or more.");
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM product_variants WHERE id = ${variantId} FOR UPDATE`);
    const [v] = await tx.select().from(productVariants).where(eq(productVariants.id, variantId));
    if (!v) throw new NotFoundError("Option not found");
    if (v.stockQuantity === quantity) return;
    await tx.update(productVariants).set({ stockQuantity: quantity, updatedAt: new Date() }).where(eq(productVariants.id, variantId));
    await tx.insert(stockMovements).values({ variantId, delta: quantity - v.stockQuantity, reason: "admin_adjustment", note: note.slice(0, 200) || null });
  });
}

export async function listInventory(db: DbOrTx, f: { q?: string; lowOnly?: boolean; threshold: number }) {
  const c: SQL[] = [ne(products.status, "archived")];
  if (f.q?.trim()) {
    const like = `%${f.q.trim().replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    c.push(or(ilike(products.name, like), ilike(productVariants.sku, like), ilike(productVariants.label, like))!);
  }
  if (f.lowOnly) c.push(sql`${productVariants.trackInventory} AND ${productVariants.stockQuantity} <= ${f.threshold}`);
  return db
    .select({ v: productVariants, productName: products.name, productId: products.id, productStatus: products.status })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(...c))
    .orderBy(asc(products.name), asc(productVariants.sortOrder))
    .limit(500);
}

export async function recentStockMovements(db: DbOrTx, limit = 30) {
  return db
    .select({ m: stockMovements, sku: productVariants.sku, productName: products.name, label: productVariants.label })
    .from(stockMovements)
    .innerJoin(productVariants, eq(productVariants.id, stockMovements.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .orderBy(desc(stockMovements.createdAt))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Categories and collections
// ---------------------------------------------------------------------------

export const groupingInputSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80),
  slug: slugField,
  summary: z.string().trim().max(200).default(""),
  intro: z.string().trim().max(3000).default(""),
  isVisible: z.boolean().default(true),
  sortOrder: intField(-1000, 1000).transform((v) => v ?? 0),
  seoTitle: z.string().trim().max(70).default(""),
  seoDescription: z.string().trim().max(170).default(""),
  startsOn: z.string().optional().nullable().transform((v) => (v ? v : null)),
  endsOn: z.string().optional().nullable().transform((v) => (v ? v : null)),
});

export async function saveCategory(db: DbOrTx, id: string | null, raw: unknown, image?: File | null) {
  const parsed = groupingInputSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  const c = parsed.data;
  const slug = c.slug || slugify(c.name);
  const imageRow = image && image.size > 0 ? await uploadImage(db, image, { alt: c.name, nameHint: slug, minSide: 300 }) : null;
  const values = { name: c.name, slug, summary: c.summary, intro: c.intro, isVisible: c.isVisible, sortOrder: c.sortOrder, seoTitle: c.seoTitle, seoDescription: c.seoDescription, updatedAt: new Date(), ...(imageRow ? { imageId: imageRow.id } : {}) };
  try {
    if (id) {
      const [row] = await db.update(categories).set(values).where(eq(categories.id, id)).returning();
      if (!row) throw new NotFoundError("Category not found");
      return row;
    }
    const [row] = await db.insert(categories).values(values).returning();
    return row;
  } catch (e) {
    if (uniqueViolation(e)) throw new ValidationError("Another category already uses this URL slug.", { slug: "Already in use" });
    throw e;
  }
}

export async function deleteCategory(db: DbOrTx, id: string) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(products).where(eq(products.categoryId, id));
  if (n > 0) throw new ConflictError(`This category has ${n} product${n === 1 ? "" : "s"}. Move them to another category or hide the category instead.`);
  await db.delete(categories).where(eq(categories.id, id));
}

export async function moveCategory(db: Database, id: string, direction: "up" | "down") {
  const all = await db.select({ id: categories.id }).from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
  const idx = all.findIndex((c) => c.id === id);
  const swap = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swap < 0 || swap >= all.length) return;
  [all[idx], all[swap]] = [all[swap], all[idx]];
  await db.transaction(async (tx) => {
    for (const [i, c] of all.entries()) await tx.update(categories).set({ sortOrder: i * 10 }).where(eq(categories.id, c.id));
  });
}

export async function saveCollection(db: DbOrTx, id: string | null, raw: unknown, image?: File | null) {
  const parsed = groupingInputSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  const c = parsed.data;
  if (c.startsOn && c.endsOn && c.endsOn < c.startsOn) throw new ValidationError("The end date is before the start date.", { endsOn: "Before start" });
  const slug = c.slug || slugify(c.name);
  const imageRow = image && image.size > 0 ? await uploadImage(db, image, { alt: c.name, nameHint: slug, minSide: 300 }) : null;
  const values = {
    name: c.name,
    slug,
    summary: c.summary,
    intro: c.intro,
    isVisible: c.isVisible,
    sortOrder: c.sortOrder,
    seoTitle: c.seoTitle,
    seoDescription: c.seoDescription,
    startsOn: c.startsOn,
    endsOn: c.endsOn,
    updatedAt: new Date(),
    ...(imageRow ? { imageId: imageRow.id } : {}),
  };
  try {
    if (id) {
      const [row] = await db.update(collections).set(values).where(eq(collections.id, id)).returning();
      if (!row) throw new NotFoundError("Collection not found");
      return row;
    }
    const [row] = await db.insert(collections).values(values).returning();
    return row;
  } catch (e) {
    if (uniqueViolation(e)) throw new ValidationError("Another collection already uses this URL slug.", { slug: "Already in use" });
    throw e;
  }
}

export async function adminCategories(db: DbOrTx) {
  return db
    .select({ c: categories, productCount: sql<number>`(SELECT count(*)::int FROM products p WHERE p.category_id = ${categories.id} AND p.status <> 'archived')`, imageFilename: media.filename })
    .from(categories)
    .leftJoin(media, eq(media.id, categories.imageId))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function adminCollections(db: DbOrTx) {
  return db
    .select({ c: collections, productCount: sql<number>`(SELECT count(*)::int FROM product_collections pc WHERE pc.collection_id = ${collections.id})`, imageFilename: media.filename })
    .from(collections)
    .leftJoin(media, eq(media.id, collections.imageId))
    .orderBy(asc(collections.sortOrder), asc(collections.name));
}
