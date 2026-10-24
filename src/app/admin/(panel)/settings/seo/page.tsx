import type { Metadata } from "next";
import Image from "next/image";
import { getDb } from "@/server/db/client";
import { getEnv } from "@/server/env";
import { getSettings } from "@/server/services/settings";
import { AdminForm, Checkbox, SubmitButton, TextArea, TextInput } from "@/components/admin/form";
import { SettingsTabs } from "@/components/admin/settings-tabs";
import { PageHeader, Panel } from "@/components/admin/ui";
import { saveSeoAction } from "../../../_actions/content";

export const metadata: Metadata = { title: "Search engines" };

export default async function SeoSettings() {
  const s = await getSettings(getDb(), "seo");
  const base = getEnv().APP_URL;
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs active="/admin/settings/seo" />
      <AdminForm action={saveSeoAction} className="space-y-5" encType="multipart/form-data">
        <Panel title="Defaults" description="Each product, category and page can override these. Rankings in Google or AI search cannot be guaranteed; useful, accurate content is what helps.">
          <div className="space-y-4">
            <TextInput name="defaultTitle" label="Home page title" defaultValue={s.defaultTitle} maxLength={80} />
            <TextInput name="titleTemplate" label="Title pattern for other pages" defaultValue={s.titleTemplate} hint="%s is replaced by the page title." />
            <TextArea name="defaultDescription" label="Home page description" defaultValue={s.defaultDescription} rows={3} maxLength={200} />
          </div>
        </Panel>
        <Panel title="Sharing image" description="Shown when the site is shared on WhatsApp or social media. 1200 × 630 pixels works best.">
          {s.ogImageId ? (
            <span className="relative mb-3 block aspect-[1200/630] max-w-sm overflow-hidden rounded-xl bg-sand">
              <Image src={`/api/media/${s.ogImageId}/share`} alt="Current sharing image" fill sizes="384px" className="object-cover" />
            </span>
          ) : null}
          <input type="file" name="ogImage" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-saffron-soft file:px-4 file:py-2 file:font-semibold file:text-saffron-dark" />
          {s.ogImageId ? (
            <div className="mt-3">
              <Checkbox name="removeOgImage" label="Remove the current image" />
            </div>
          ) : null}
        </Panel>
        <Panel title="Google Search Console">
          <TextInput name="googleSiteVerification" label="Verification code (HTML tag method, content value only)" defaultValue={s.googleSiteVerification} />
          <p className="mt-3 text-sm text-muted">
            Submit your sitemap in Search Console: <span className="font-mono">{base}/sitemap.xml</span>
          </p>
        </Panel>
        <SubmitButton>Save</SubmitButton>
      </AdminForm>
    </>
  );
}
