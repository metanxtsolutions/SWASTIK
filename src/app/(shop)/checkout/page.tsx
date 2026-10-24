import type { Metadata } from "next";
import { getDb } from "@/server/db/client";
import { siteData } from "@/server/site";
import { paymentOptions } from "@/server/services/orders";
import { CheckoutForm } from "@/components/shop/checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const site = await siteData();
  const opts = await paymentOptions(getDb());
  const { business, checkout } = site.settings;
  return (
    <div className="container-page py-6 pb-36 lg:pb-10">
      <h1 className="mb-1 text-3xl font-semibold">Checkout</h1>
      <p className="mb-5 text-ink-soft">No account needed. We only ask for what we need to deliver your flowers.</p>
      <CheckoutForm
        options={{
          ...opts,
          whatsappAvailable: !!business.whatsapp,
          checkoutNote: checkout.checkoutNote,
          defaultCity: business.city,
          termsHref: site.footerPages.some((p) => p.slug === "terms-and-conditions") ? "/terms-and-conditions" : null,
        }}
      />
    </div>
  );
}
