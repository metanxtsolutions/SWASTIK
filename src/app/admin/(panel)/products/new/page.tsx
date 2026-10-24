import type { Metadata } from "next";
import { getDb } from "@/server/db/client";
import { catalogOptions } from "@/server/admin-data";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";
import { createProductAction } from "../../../_actions/catalog";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage() {
  const opts = await catalogOptions(getDb());
  return (
    <>
      <PageHeader back={{ href: "/admin/products", label: "Products" }} title="Add product" description="Save as a draft first if you are not ready to sell it. You can add photos after saving." />
      <ProductForm
        action={createProductAction}
        {...opts}
        initial={{ name: "", slug: "", categoryId: "", shortDescription: "", description: "", usageInfo: "", careInfo: "", unit: "piece", tags: "", status: "draft", isFeatured: false, isBestseller: false, sortOrder: "0", seoTitle: "", seoDescription: "", collectionIds: [], zoneIds: [], variants: [] }}
      />
    </>
  );
}
