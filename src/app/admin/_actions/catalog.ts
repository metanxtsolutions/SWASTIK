"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { adminAction, fd } from "@/server/admin-action";
import type { ActionState } from "@/server/admin-action-types";
import { ValidationError } from "@/server/errors";
import {
  addProductImages,
  deleteCategory,
  deleteProduct,
  moveCategory,
  saveCategory,
  saveCollection,
  saveProduct,
  setStock,
  updateProductImage,
} from "@/server/services/admin-catalog";
import { getDb } from "@/server/db/client";
import { collections } from "@/server/db/schema";
import { eq } from "drizzle-orm";

function productPayload(form: FormData) {
  let variants: unknown = [];
  try {
    variants = JSON.parse(fd.str(form, "variants") || "[]");
  } catch {
    throw new ValidationError("The product options could not be read. Reload the page and try again.");
  }
  return {
    name: fd.str(form, "name"),
    slug: fd.str(form, "slug"),
    categoryId: fd.str(form, "categoryId"),
    shortDescription: fd.str(form, "shortDescription"),
    description: fd.str(form, "description"),
    usageInfo: fd.str(form, "usageInfo"),
    careInfo: fd.str(form, "careInfo"),
    unit: fd.str(form, "unit"),
    tags: fd.str(form, "tags"),
    status: fd.str(form, "status"),
    isFeatured: fd.bool(form, "isFeatured"),
    isBestseller: fd.bool(form, "isBestseller"),
    sortOrder: fd.str(form, "sortOrder"),
    seoTitle: fd.str(form, "seoTitle"),
    seoDescription: fd.str(form, "seoDescription"),
    collectionIds: fd.all(form, "collectionIds"),
    zoneIds: fd.all(form, "zoneIds"),
    variants,
  };
}

export async function createProductAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  let id: string | null = null;
  const state = await adminAction(async (ctx) => {
    const saved = await saveProduct(ctx.db, null, productPayload(form));
    await ctx.audit("product.created", "product", saved.id, { name: fd.str(form, "name"), status: fd.str(form, "status") });
    id = saved.id;
    return "Product created. Add photos below.";
  });
  if (state.ok && id) redirect(`/admin/products/${id}?created=1`);
  return state;
}

export async function updateProductAction(productId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    await saveProduct(ctx.db, productId, productPayload(form));
    await ctx.audit("product.updated", "product", productId, { status: fd.str(form, "status") });
    return "Product saved.";
  });
}

export async function deleteProductAction(productId: string, _prev: ActionState): Promise<ActionState> {
  let deleted = false;
  const state = await adminAction(async (ctx) => {
    const result = await deleteProduct(ctx.db, productId);
    await ctx.audit(`product.${result}`, "product", productId);
    deleted = result === "deleted";
    return result === "deleted" ? "Product deleted." : "This product has orders, so it was archived instead of deleted. Archived products are hidden from the shop.";
  });
  if (deleted) redirect("/admin/products");
  return state;
}

export async function uploadProductImagesAction(productId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    await addProductImages(ctx.db, productId, fd.files(form, "images"), fd.str(form, "alt"));
    await ctx.audit("product.images_added", "product", productId);
    return "Photos uploaded.";
  });
}

export async function updateProductImageAction(productId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    const op = fd.str(form, "op");
    await updateProductImage(ctx.db, productId, fd.str(form, "imageId"), op === "remove" ? { remove: true } : op === "main" ? { makeMain: true } : { alt: fd.str(form, "alt") });
    return op === "remove" ? "Photo removed." : op === "main" ? "Main photo changed." : "Description saved.";
  });
}

export async function setStockAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    const qty = Number(fd.str(form, "stock"));
    const variantId = z.string().uuid().parse(fd.str(form, "variantId"));
    await setStock(ctx.db, variantId, qty, fd.str(form, "note"));
    await ctx.audit("stock.set", "variant", variantId, { stock: qty });
    return "Stock updated.";
  });
}

function groupingPayload(form: FormData) {
  return {
    name: fd.str(form, "name"),
    slug: fd.str(form, "slug"),
    summary: fd.str(form, "summary"),
    intro: fd.str(form, "intro"),
    isVisible: fd.bool(form, "isVisible"),
    sortOrder: fd.str(form, "sortOrder"),
    seoTitle: fd.str(form, "seoTitle"),
    seoDescription: fd.str(form, "seoDescription"),
    startsOn: fd.str(form, "startsOn"),
    endsOn: fd.str(form, "endsOn"),
  };
}

export async function saveCategoryAction(categoryId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    const row = await saveCategory(ctx.db, categoryId === "new" ? null : categoryId, groupingPayload(form), fd.file(form, "image"));
    await ctx.audit(categoryId === "new" ? "category.created" : "category.updated", "category", row.id, { name: row.name });
    return categoryId === "new" ? `Category “${row.name}” created.` : "Category saved.";
  });
}

export async function deleteCategoryAction(categoryId: string, _prev: ActionState): Promise<ActionState> {
  let done = false;
  const state = await adminAction(async (ctx) => {
    await deleteCategory(ctx.db, categoryId);
    await ctx.audit("category.deleted", "category", categoryId);
    done = true;
    return "Category deleted.";
  });
  if (done) redirect("/admin/categories");
  return state;
}

export async function moveCategoryAction(categoryId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    await moveCategory(ctx.db, categoryId, fd.str(form, "direction") === "up" ? "up" : "down");
    return "Order changed.";
  });
}

export async function saveCollectionAction(collectionId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    const row = await saveCollection(ctx.db, collectionId === "new" ? null : collectionId, groupingPayload(form), fd.file(form, "image"));
    await ctx.audit(collectionId === "new" ? "collection.created" : "collection.updated", "collection", row.id, { name: row.name });
    return collectionId === "new" ? `Collection “${row.name}” created.` : "Collection saved.";
  });
}

export async function deleteCollectionAction(collectionId: string, _prev: ActionState): Promise<ActionState> {
  let done = false;
  const state = await adminAction(async (ctx) => {
    await getDb().delete(collections).where(eq(collections.id, collectionId));
    await ctx.audit("collection.deleted", "collection", collectionId);
    done = true;
    return "Collection deleted.";
  });
  if (done) redirect("/admin/collections");
  return state;
}
