"use client";

import type { ActionState } from "@/server/admin-action-types";
import { ProductForm, type ProductFormValues } from "./product-form";

export function ProductEdit({ id, action, ...rest }: { id: string; action: (id: string, prev: ActionState, fd: FormData) => Promise<ActionState>; initial: ProductFormValues; categories: { id: string; name: string }[]; collections: { id: string; name: string }[]; zones: { id: string; name: string }[] }) {
  return <ProductForm action={action.bind(null, id)} {...rest} />;
}
