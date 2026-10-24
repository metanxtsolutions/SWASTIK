"use client";

import type { ActionState } from "@/server/admin-action-types";
import { AdminForm } from "./form";

/** An AdminForm bound to a record id (server actions receive the id as their first argument). */
export function BoundForm({ action, id, children, className, resetOnSuccess, encType }: { action: (id: string, prev: ActionState, fd: FormData) => Promise<ActionState>; id: string; children: React.ReactNode; className?: string; resetOnSuccess?: boolean; encType?: "multipart/form-data" }) {
  return (
    <AdminForm action={action.bind(null, id)} className={className} resetOnSuccess={resetOnSuccess} encType={encType}>
      {children}
    </AdminForm>
  );
}
