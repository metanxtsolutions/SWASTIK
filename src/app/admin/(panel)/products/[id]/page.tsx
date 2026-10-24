import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getDb } from "@/server/db/client";
import { catalogOptions } from "@/server/admin-data";
import { getAdminProduct } from "@/server/services/admin-catalog";
import { paiseToRupeesInput } from "@/lib/money";
import { BoundForm } from "@/components/admin/bound-form";
import { SubmitButton, TextInput } from "@/components/admin/form";
import { ProductEdit } from "@/components/admin/product-edit";
import { PageHeader, Panel } from "@/components/admin/ui";
import { deleteProductAction, updateProductAction, updateProductImageAction, uploadProductImagesAction } from "../../../_actions/catalog";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  const { created } = await searchParams;
  const db = getDb();
  const [data, opts] = await Promise.all([getAdminProduct(db, id), catalogOptions(db)]);
  if (!data) notFound();
  const { product: p, variants, images } = data;
  return (
    <>
      <PageHeader
        back={{ href: "/admin/products", label: "Products" }}
        title={p.name}
        description={created ? "Product created. Add photos below, then publish when ready." : undefined}
        actions={
          p.status === "published" ? (
            <Link href={`/product/${p.slug}`} target="_blank" className="btn btn-secondary btn-sm">
              <ExternalLink aria-hidden className="h-4 w-4" />
              View in shop
            </Link>
          ) : null
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <ProductEdit
          id={p.id}
          action={updateProductAction}
          {...opts}
          initial={{
            name: p.name,
            slug: p.slug,
            categoryId: p.categoryId ?? "",
            shortDescription: p.shortDescription,
            description: p.description,
            usageInfo: p.usageInfo,
            careInfo: p.careInfo,
            unit: p.unit,
            tags: p.tags.join(", "),
            status: p.status,
            isFeatured: p.isFeatured,
            isBestseller: p.isBestseller,
            sortOrder: String(p.sortOrder),
            seoTitle: p.seoTitle,
            seoDescription: p.seoDescription,
            collectionIds: data.collectionIds,
            zoneIds: data.zoneIds,
            variants: variants.map((v) => ({
              key: v.id,
              id: v.id,
              label: v.label,
              sku: v.sku,
              unit: v.unit,
              price: paiseToRupeesInput(v.pricePaise),
              salePrice: paiseToRupeesInput(v.salePricePaise),
              trackInventory: v.trackInventory,
              stockQuantity: String(v.stockQuantity),
              minOrderQty: String(v.minOrderQty),
              maxOrderQty: v.maxOrderQty ? String(v.maxOrderQty) : "",
              isActive: v.isActive,
            })),
          }}
        />
        <div className="space-y-5">
          <Panel title="Photos" description="JPEG, PNG or WebP, at least 400 × 400 pixels, up to 5 MB. Square photos look best. The first photo is the main one.">
            {images.length ? (
              <ul className="mb-4 space-y-3">
                {images.map((img, i) => (
                  <li key={img.id} className="rounded-xl border border-line p-2">
                    <div className="flex gap-3">
                      <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-sand">
                        <Image src={`/api/media/${img.m.id}/${img.m.filename}`} alt={img.alt || p.name} fill sizes="80px" className="object-cover" />
                      </span>
                      <div className="min-w-0 flex-1 space-y-2">
                        {i === 0 ? <p className="text-xs font-bold text-leaf">Main photo</p> : null}
                        <BoundForm action={updateProductImageAction} id={p.id} className="space-y-1">
                          <input type="hidden" name="imageId" value={img.id} />
                          <input type="hidden" name="op" value="alt" />
                          <TextInput name="alt" label="Description" defaultValue={img.alt} placeholder={`e.g. ${p.name} in a basket`} />
                          <SubmitButton variant="secondary" className="btn-sm">
                            Save description
                          </SubmitButton>
                        </BoundForm>
                        <div className="flex gap-2">
                          {i > 0 ? (
                            <BoundForm action={updateProductImageAction} id={p.id}>
                              <input type="hidden" name="imageId" value={img.id} />
                              <input type="hidden" name="op" value="main" />
                              <SubmitButton variant="secondary" className="btn-sm">
                                Make main
                              </SubmitButton>
                            </BoundForm>
                          ) : null}
                          <BoundForm action={updateProductImageAction} id={p.id}>
                            <input type="hidden" name="imageId" value={img.id} />
                            <input type="hidden" name="op" value="remove" />
                            <SubmitButton variant="secondary" className="btn-sm" confirm="Remove this photo?">
                              Remove
                            </SubmitButton>
                          </BoundForm>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-3 rounded-xl bg-marigold-soft p-3 text-sm">No photos yet. The shop shows an illustration until you add one.</p>
            )}
            <BoundForm action={uploadProductImagesAction} id={p.id} className="space-y-3" encType="multipart/form-data" resetOnSuccess>
              <label className="block text-sm">
                <span className="field-label">Add photos</span>
                <input type="file" name="images" accept="image/jpeg,image/png,image/webp" multiple className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-saffron-soft file:px-4 file:py-2 file:font-semibold file:text-saffron-dark" />
              </label>
              <TextInput name="alt" label="Describe the photo" placeholder={`e.g. Fresh ${p.name.toLowerCase()}`} hint="Helps customers using screen readers and search engines." />
              <SubmitButton>Upload</SubmitButton>
            </BoundForm>
          </Panel>
          <Panel title="Delete product">
            <p className="mb-3 text-sm text-muted">Products that have been ordered are archived instead, so order history stays intact.</p>
            <BoundForm action={deleteProductAction} id={p.id}>
              <SubmitButton variant="danger" className="btn-sm" confirm="Delete this product? This cannot be undone.">
                Delete product
              </SubmitButton>
            </BoundForm>
          </Panel>
        </div>
      </div>
    </>
  );
}
