import type { Metadata } from "next";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { siteData } from "@/server/site";
import { whatsappLink } from "@/lib/phone";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { ContactForm } from "@/components/shop/contact-form";
import { JsonLd } from "@/components/shop/json-ld";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await siteData();
  return {
    title: `Contact ${settings.business.name}`,
    description: `Contact ${settings.business.name} about puja flower orders, deliveries and bulk requirements.`,
    alternates: { canonical: "/contact" },
  };
}

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  const site = await siteData();
  const { business } = site.settings;
  const wa = business.whatsapp ? whatsappLink(business.whatsapp, "Namaskar, I have a question.") : null;
  const address = [business.addressLine, business.locality, business.city !== business.locality ? business.city : "", business.district, business.state, business.pincode].filter(Boolean).join(", ");
  // LocalBusiness data is published only after the owner confirms the details are accurate.
  const localBusiness =
    business.detailsVerified && business.addressLine && business.phone
      ? {
          "@context": "https://schema.org",
          "@type": "Florist",
          name: business.name,
          url: site.appUrl,
          telephone: business.phone,
          ...(business.email ? { email: business.email } : {}),
          address: { "@type": "PostalAddress", streetAddress: business.addressLine, addressLocality: business.city, addressRegion: business.state, postalCode: business.pincode, addressCountry: "IN" },
          ...(business.mapUrl ? { hasMap: business.mapUrl } : {}),
          areaServed: business.district || business.city,
        }
      : null;
  return (
    <div className="container-page py-6">
      <Breadcrumbs baseUrl={site.appUrl} items={[{ name: "Contact", href: "/contact" }]} />
      <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Contact us</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <section className="card space-y-4 p-6" aria-label="Contact details">
          {business.phone ? (
            <a href={`tel:${business.phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-3 font-semibold hover:text-saffron-dark">
              <Phone aria-hidden className="h-5 w-5 text-saffron" />
              {business.phone}
            </a>
          ) : null}
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 font-semibold hover:text-saffron-dark">
              <MessageCircle aria-hidden className="h-5 w-5 text-leaf" />
              WhatsApp {business.whatsapp}
            </a>
          ) : null}
          {business.email ? (
            <a href={`mailto:${business.email}`} className="flex items-center gap-3 break-all font-semibold hover:text-saffron-dark">
              <Mail aria-hidden className="h-5 w-5 text-saffron" />
              {business.email}
            </a>
          ) : null}
          {address ? (
            <p className="flex gap-3">
              <MapPin aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-saffron" />
              <span>
                {address}
                {business.mapUrl ? (
                  <a href={business.mapUrl} target="_blank" rel="noopener noreferrer" className="block text-sm font-semibold text-saffron-dark underline">
                    Open in maps
                  </a>
                ) : null}
              </span>
            </p>
          ) : null}
          {business.hours ? (
            <p className="flex gap-3">
              <Clock aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-saffron" />
              {business.hours}
            </p>
          ) : null}
          {!business.phone && !wa && !business.email ? <p className="text-ink-soft">Send us a message with the form and we will get back to you.</p> : null}
        </section>
        <section className="card p-6" aria-labelledby="c-form-title">
          <h2 id="c-form-title" className="mb-4 text-xl font-semibold">
            Send a message
          </h2>
          <ContactForm initialOrder={(order ?? "").slice(0, 20)} />
        </section>
      </div>
      {localBusiness ? <JsonLd data={localBusiness} /> : null}
    </div>
  );
}
