import { BoundForm } from "./bound-form";
import { Checkbox, SubmitButton, TextArea, TextInput } from "./form";
import type { ActionState } from "@/server/admin-action-types";

export interface GroupingValues {
  name: string;
  slug: string;
  summary: string;
  intro: string;
  isVisible: boolean;
  sortOrder: number;
  seoTitle: string;
  seoDescription: string;
  startsOn?: string | null;
  endsOn?: string | null;
}

/** Shared form for categories and collections. */
export function GroupingForm({ id, action, values, kind }: { id: string; action: (id: string, prev: ActionState, fd: FormData) => Promise<ActionState>; values: GroupingValues; kind: "category" | "collection" }) {
  return (
    <BoundForm action={action} id={id} className="space-y-4" encType="multipart/form-data" resetOnSuccess={id === "new"}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput name="name" label="Name" defaultValue={values.name} required />
        <TextInput name="slug" label="URL slug" defaultValue={values.slug} hint={`Leave empty to create from the name. Appears as /${kind === "category" ? "category" : "collections"}/slug.`} />
      </div>
      <TextInput name="summary" label="Summary" defaultValue={values.summary} maxLength={200} hint="One sentence shown under the heading." />
      <TextArea name="intro" label="Introduction (optional)" defaultValue={values.intro} rows={6} hint="Helpful, original information for customers and search engines. Use ## for headings and - for lists." />
      {kind === "collection" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput name="startsOn" type="date" label="Show from (optional)" defaultValue={values.startsOn ?? ""} />
          <TextInput name="endsOn" type="date" label="Show until (optional)" defaultValue={values.endsOn ?? ""} />
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput name="seoTitle" label="SEO title (optional)" defaultValue={values.seoTitle} maxLength={70} />
        <TextInput name="sortOrder" label="Sort order" defaultValue={String(values.sortOrder)} inputMode="numeric" />
      </div>
      <TextArea name="seoDescription" label="SEO description (optional)" defaultValue={values.seoDescription} rows={2} maxLength={170} />
      <label className="block text-sm">
        <span className="field-label">Image (optional, square, at least 300 × 300)</span>
        <input type="file" name="image" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-saffron-soft file:px-4 file:py-2 file:font-semibold file:text-saffron-dark" />
      </label>
      <Checkbox name="isVisible" label="Visible in the shop" hint={`A visible ${kind} still appears only once it has published products.`} defaultChecked={values.isVisible} />
      <SubmitButton>{id === "new" ? `Create ${kind}` : "Save"}</SubmitButton>
    </BoundForm>
  );
}
