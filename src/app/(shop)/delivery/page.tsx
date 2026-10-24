import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/server/db/client";
import { siteData } from "@/server/site";
import { publishedFaqs } from "@/server/services/content";
import { listActiveZones, MIN_LANDING_CONTENT } from "@/server/services/delivery";
import { formatTime } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { DeliveryCheck } from "@/components/shop/delivery-check";
import { FaqList } from "@/components/shop/faq-list";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await siteData();
  return {
    title: "Delivery areas, charges and time slots",
    description: `Where ${settings.business.name} delivers puja flowers, delivery charges, minimum order and available time slots.`,
    alternates: { canonical: "/delivery" },
  };
}

export default async function DeliveryPage() {
  const db = getDb();
  const site = await siteData();
  const [zones, faqs] = await Promise.all([listActiveZones(db), publishedFaqs(db, { topics: ["delivery"] })]);
  return (
    <div className="container-page max-w-5xl py-6">
      <Breadcrumbs baseUrl={site.appUrl} items={[{ name: "Delivery information", href: "/delivery" }]} />
      <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Delivery information</h1>
      <p className="mt-2 max-w-2xl text-lg text-ink-soft">We deliver only to the areas listed here. Enter your PIN code to see the dates and time slots open for you.</p>
      <div className="card mt-5 p-5">
        <DeliveryCheck />
      </div>
      <section aria-labelledby="zones" className="mt-8">
        <h2 id="zones" className="section-title mb-4">
          Areas we deliver to
        </h2>
        {zones.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {zones.map((z) => (
              <li key={z.id} className="card p-5">
                <h3 className="text-xl font-semibold">
                  {z.landingPublished && z.landingContent.length >= MIN_LANDING_CONTENT ? (
                    <Link href={`/delivery-areas/${z.slug}`} className="hover:text-saffron-dark">
                      {z.name}
                    </Link>
                  ) : (
                    z.name
                  )}
                </h3>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-muted">PIN codes</dt>
                  <dd>{z.pincodes.map((p) => `${p.pincode}${p.localities ? ` (${p.localities})` : ""}`).join(", ")}</dd>
                  <dt className="text-muted">Delivery charge</dt>
                  <dd>
                    {z.deliveryFeePaise ? formatINR(z.deliveryFeePaise) : "Free"}
                    {z.freeDeliveryAbovePaise && z.deliveryFeePaise ? `, free on orders of ${formatINR(z.freeDeliveryAbovePaise)} or more` : ""}
                  </dd>
                  {z.minOrderPaise ? (
                    <>
                      <dt className="text-muted">Minimum order</dt>
                      <dd>{formatINR(z.minOrderPaise)}</dd>
                    </>
                  ) : null}
                  <dt className="text-muted">Earliest delivery</dt>
                  <dd>{z.minLeadDays === 0 && z.sameDayEnabled ? `Same day for orders before ${z.sameDayCutoff ? formatTime(z.sameDayCutoff) : "the cut-off"}` : z.minLeadDays <= 1 ? "Next day" : `${z.minLeadDays} days after ordering`}</dd>
                  {z.slots.length ? (
                    <>
                      <dt className="text-muted">Time slots</dt>
                      <dd>{z.slots.join("; ")}</dd>
                    </>
                  ) : null}
                </dl>
                {z.instructions ? <p className="mt-3 text-sm text-ink-soft">{z.instructions}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="card p-5 text-ink-soft">
            Home delivery is being set up. Please <Link href="/contact" className="font-semibold text-saffron-dark underline">contact us</Link> to arrange an order.
          </p>
        )}
        <p className="mt-4 text-sm text-muted">
          Not in these areas? For larger orders, send a <Link href="/bulk-orders" className="font-semibold text-saffron-dark underline">bulk enquiry</Link> with your PIN code and we will let you know whether we can help.
        </p>
      </section>
      {faqs.length ? (
        <section aria-labelledby="d-faq" className="mt-10 max-w-3xl">
          <h2 id="d-faq" className="section-title mb-4">
            Delivery questions
          </h2>
          <FaqList faqs={faqs} />
        </section>
      ) : null}
    </div>
  );
}
