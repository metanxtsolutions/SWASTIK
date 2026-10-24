import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange, ClipboardList, MessageCircle, PhoneCall, Repeat, SearchCheck, Truck } from "lucide-react";
import { getDb } from "@/server/db/client";
import { siteData } from "@/server/site";
import { getArticle, publishedFaqs } from "@/server/services/content";
import { listActiveZones } from "@/server/services/delivery";
import { addDays, todayInIndia } from "@/lib/dates";
import { whatsappLink } from "@/lib/phone";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { BulkEnquiryForm } from "@/components/shop/bulk-form";
import { CategoryTiles } from "@/components/shop/category-tiles";
import { FaqList } from "@/components/shop/faq-list";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await siteData();
  const where = [settings.business.locality, settings.business.district].filter(Boolean).join(", ") || "Rishra, Hooghly";
  return {
    title: `Bulk puja flowers for mandirs and events in ${where}`,
    description: `Request a quote for bulk puja flowers and garlands for temples, puja committees, pandits and events. One-time or regular supply from ${settings.business.name}.`,
    alternates: { canonical: "/bulk-orders" },
  };
}

const STEPS = [
  { icon: ClipboardList, title: "Send your requirement", body: "List each flower variety with its quantity, the date and the delivery address." },
  { icon: SearchCheck, title: "We check availability", body: "We review what we can supply for your dates and work out the pricing." },
  { icon: PhoneCall, title: "We contact you", body: "We call or message you to discuss the details and share a quotation." },
  { icon: Truck, title: "Confirm and receive", body: "Once you accept the quotation, we confirm delivery and payment arrangements with you." },
];

export default async function BulkOrdersPage() {
  const db = getDb();
  const site = await siteData();
  const { business } = site.settings;
  const [zones, faqs, planningGuide] = await Promise.all([listActiveZones(db), publishedFaqs(db, { topics: ["bulk"] }), getArticle(db, "planning-flower-quantities-for-mandirs-and-events")]);
  const wa = business.whatsapp ? whatsappLink(business.whatsapp, "Namaskar, I would like a quote for a bulk flower order.") : null;
  const suggestions = [...new Set(["Marigold (orange)", "Marigold (yellow)", "Marigold garland", "Rose", "Rose petals", "Jasmine (bela)", "Mogra", "Red hibiscus (jaba)", "Lotus", "Bel patra", "Tulsi", "Durva grass", "Tuberose (rajanigandha)", "Mixed flowers", ...site.categories.map((c) => c.name)])];

  return (
    <div className="pb-6">
      <div className="container-page pt-5">
        <Breadcrumbs baseUrl={site.appUrl} items={[{ name: "Bulk orders", href: "/bulk-orders" }]} />
      </div>
      <section className="container-page mt-4">
        <div className="grid gap-6 rounded-3xl bg-kumkum p-6 text-white sm:p-10 lg:grid-cols-[1.5fr_1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-white/80">Mandirs, puja committees, pandits and event organisers</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-5xl">Bulk puja flowers for temples and large pujas</h1>
            <p className="mt-4 max-w-2xl text-lg text-white/90">
              Tell us what you need for daily temple worship, a festival or a community puja. We review availability and pricing for your dates and contact you with a quotation.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <a href="#enquiry" className="btn bg-paper px-6 text-base text-kumkum hover:bg-cream">
              Request a bulk quote
            </a>
            {wa ? (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn border border-white/40 px-6 text-base text-white hover:bg-white/10">
                <MessageCircle aria-hidden className="h-5 w-5" />
                Chat on WhatsApp
              </a>
            ) : null}
            {business.phone ? (
              <a href={`tel:${business.phone.replace(/[^\d+]/g, "")}`} className="btn border border-white/40 px-6 text-base text-white hover:bg-white/10">
                <PhoneCall aria-hidden className="h-5 w-5" />
                Call {business.phone}
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <section aria-labelledby="how" className="container-page py-10">
        <h2 id="how" className="section-title">
          How bulk ordering works
        </h2>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card p-5">
              <span className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-kumkum-soft text-kumkum">
                  <s.icon aria-hidden className="h-5 w-5" />
                </span>
                <span className="text-sm font-bold text-muted">Step {i + 1}</span>
              </span>
              <h3 className="mt-3 font-sans text-base font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted">An enquiry is not a confirmed order. Quantities, prices and delivery are confirmed only when we confirm them with you.</p>
      </section>

      {site.categories.length ? (
        <section aria-labelledby="bulk-cats" className="container-page py-4">
          <h2 id="bulk-cats" className="section-title">
            Flowers you can ask for
          </h2>
          <p className="mt-1.5 max-w-2xl text-ink-soft">Our regular range is a good starting point. You can also ask for varieties not listed here.</p>
          <div className="mt-5">
            <CategoryTiles categories={site.categories} />
          </div>
        </section>
      ) : null}

      <section className="container-page grid gap-4 py-10 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Repeat aria-hidden className="h-5 w-5 text-saffron" />
            Regular requirements
          </h2>
          <p className="mt-2 text-ink-soft">
            Many temples need flowers every day or on fixed days of the week. Choose daily, weekly, monthly or festival season in the form and describe the schedule, and we will discuss a regular supply with you.
          </p>
        </div>
        <div className="card p-6">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <CalendarRange aria-hidden className="h-5 w-5 text-saffron" />
            Delivery locations
          </h2>
          {zones.length ? (
            <>
              <p className="mt-2 text-ink-soft">Our regular delivery areas:</p>
              <ul className="mt-2 space-y-1 text-sm">
                {zones.map((z) => (
                  <li key={z.id}>
                    <span className="font-semibold">{z.name}</span>: PIN {z.pincodes.map((p) => p.pincode).join(", ")}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-muted">For a bulk order outside these areas, send your enquiry anyway with your PIN code, and we will tell you whether we can deliver.</p>
            </>
          ) : (
            <p className="mt-2 text-ink-soft">Send your enquiry with your PIN code and we will tell you whether we can deliver to you.</p>
          )}
        </div>
      </section>

      <section id="enquiry" aria-labelledby="enquiry-title" className="container-page scroll-mt-40 py-4">
        <div className="card p-5 sm:p-8">
          <h2 id="enquiry-title" className="section-title">
            Request a bulk quote
          </h2>
          <p className="mb-6 mt-1.5 text-ink-soft">Takes about two minutes. Add as many flower varieties as you need.</p>
          <BulkEnquiryForm suggestions={suggestions} minDate={addDays(todayInIndia(), 0)} />
        </div>
      </section>

      {faqs.length ? (
        <section aria-labelledby="bulk-faq" className="container-page max-w-3xl py-10">
          <h2 id="bulk-faq" className="section-title mb-4">
            Bulk order questions
          </h2>
          <FaqList faqs={faqs} />
          {planningGuide ? (
            <p className="mt-4 text-sm text-muted">
              Planning quantities for the first time? Read our guide to{" "}
              <Link href={`/guides/${planningGuide.slug}`} className="font-semibold text-saffron-dark underline">
                planning flower quantities
              </Link>
              .
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
