import type { Metadata } from "next";
import { getDb } from "@/server/db/client";
import { getSettings } from "@/server/services/settings";
import { AdminForm, Checkbox, SubmitButton, TextInput } from "@/components/admin/form";
import { SettingsTabs } from "@/components/admin/settings-tabs";
import { PageHeader, Panel } from "@/components/admin/ui";
import { saveBusinessAction } from "../../_actions/content";

export const metadata: Metadata = { title: "Settings" };

export default async function BusinessSettings() {
  const b = await getSettings(getDb(), "business");
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs active="/admin/settings" />
      <AdminForm action={saveBusinessAction} className="space-y-5">
        <Panel title="Business">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput name="name" label="Business name" defaultValue={b.name} />
            <TextInput name="tagline" label="Tagline" defaultValue={b.tagline} />
            <TextInput name="gstin" label="GSTIN (optional)" defaultValue={b.gstin} />
            <TextInput name="hours" label="Business hours (optional)" defaultValue={b.hours} placeholder="e.g. Every day, 5 am to 8 pm" />
          </div>
        </Panel>
        <Panel title="Contact" description="Shown to customers. Leave a field empty to hide it. Use verified numbers only.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput name="phone" label="Phone" defaultValue={b.phone} placeholder="+91 98xxx xxxxx" />
            <TextInput name="whatsapp" label="WhatsApp number" defaultValue={b.whatsapp} placeholder="919800000000" hint="With country code. Enables WhatsApp buttons on the site." />
            <TextInput name="email" label="Public email" defaultValue={b.email} type="email" />
            <TextInput name="notificationEmail" label="Email for new order and enquiry alerts" defaultValue={b.notificationEmail} type="email" hint="Not shown on the website." />
          </div>
        </Panel>
        <Panel title="Address">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput name="addressLine" label="Street address" defaultValue={b.addressLine} className="sm:col-span-2" />
            <TextInput name="locality" label="Locality" defaultValue={b.locality} />
            <TextInput name="city" label="Town or city" defaultValue={b.city} />
            <TextInput name="district" label="District" defaultValue={b.district} />
            <TextInput name="state" label="State" defaultValue={b.state} />
            <TextInput name="pincode" label="PIN code" defaultValue={b.pincode} inputMode="numeric" />
            <TextInput name="mapUrl" label="Google Maps link (optional)" defaultValue={b.mapUrl} placeholder="https://maps.app.goo.gl/..." />
          </div>
          <div className="mt-4">
            <Checkbox name="detailsVerified" label="These address and phone details are correct and can be published for search engines" hint="Turns on local business information (structured data) on the Contact page. Keep it identical to your Google Business Profile." defaultChecked={b.detailsVerified} />
          </div>
        </Panel>
        <Panel title="Social links (optional)">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput name="facebook" label="Facebook" defaultValue={b.social.facebook} />
            <TextInput name="instagram" label="Instagram" defaultValue={b.social.instagram} />
            <TextInput name="youtube" label="YouTube" defaultValue={b.social.youtube} />
            <TextInput name="googleBusiness" label="Google Business Profile" defaultValue={b.social.googleBusiness} />
          </div>
        </Panel>
        <SubmitButton>Save business details</SubmitButton>
      </AdminForm>
    </>
  );
}
