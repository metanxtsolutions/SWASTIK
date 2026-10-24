import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import type { SiteData } from "@/server/site";
import { whatsappLink } from "@/lib/phone";
import { Logo } from "../logo";

export function SiteFooter({ site }: { site: SiteData }) {
  const { business } = site.settings;
  const address = [business.addressLine, business.locality, business.city !== business.locality ? business.city : "", business.district, business.state, business.pincode].filter(Boolean).join(", ");
  const wa = business.whatsapp ? whatsappLink(business.whatsapp) : null;
  const social = Object.entries(business.social).filter(([, url]) => url) as [string, string][];
  const socialNames: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", youtube: "YouTube", googleBusiness: "Google" };
  return (
    <footer className="mt-16 border-t border-line bg-sand/60">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo name={business.name} />
          <p className="max-w-xs text-sm text-ink-soft">
            {business.tagline}. Puja flowers, garlands and leaves from {business.locality || "Rishra"}, {business.district || "Hooghly"}.
          </p>
        </div>
        <nav aria-label="Shop">
          <h2 className="mb-3 font-sans text-sm font-bold uppercase tracking-wider text-muted">Shop</h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/shop" className="hover:text-saffron-dark hover:underline">
                All flowers
              </Link>
            </li>
            {site.categories.slice(0, 6).map((c) => (
              <li key={c.id}>
                <Link href={`/category/${c.slug}`} className="hover:text-saffron-dark hover:underline">
                  {c.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/bulk-orders" className="hover:text-saffron-dark hover:underline">
                Bulk orders for mandirs
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Help">
          <h2 className="mb-3 font-sans text-sm font-bold uppercase tracking-wider text-muted">Help</h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/track" className="hover:text-saffron-dark hover:underline">
                Track your order
              </Link>
            </li>
            <li>
              <Link href="/delivery" className="hover:text-saffron-dark hover:underline">
                Delivery information
              </Link>
            </li>
            <li>
              <Link href="/faq" className="hover:text-saffron-dark hover:underline">
                Questions and answers
              </Link>
            </li>
            <li>
              <Link href="/guides" className="hover:text-saffron-dark hover:underline">
                Flower guides
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-saffron-dark hover:underline">
                Contact us
              </Link>
            </li>
            {site.footerPages.map((p) => (
              <li key={p.slug}>
                <Link href={`/${p.slug}`} className="hover:text-saffron-dark hover:underline">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className="mb-3 font-sans text-sm font-bold uppercase tracking-wider text-muted">Contact</h2>
          <ul className="space-y-2.5 text-sm text-ink-soft">
            {business.phone ? (
              <li className="flex gap-2">
                <Phone aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-saffron" />
                <a href={`tel:${business.phone.replace(/[^\d+]/g, "")}`} className="hover:underline">
                  {business.phone}
                </a>
              </li>
            ) : null}
            {wa ? (
              <li className="flex gap-2">
                <MessageCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-leaf" />
                <a href={wa} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  WhatsApp {business.whatsapp}
                </a>
              </li>
            ) : null}
            {business.email ? (
              <li className="flex gap-2">
                <Mail aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-saffron" />
                <a href={`mailto:${business.email}`} className="break-all hover:underline">
                  {business.email}
                </a>
              </li>
            ) : null}
            {address ? (
              <li className="flex gap-2">
                <MapPin aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-saffron" />
                <span>{address}</span>
              </li>
            ) : null}
            {business.hours ? <li>Hours: {business.hours}</li> : null}
            {!business.phone && !business.email && !wa ? (
              <li>
                <Link href="/contact" className="font-semibold text-saffron-dark hover:underline">
                  Send us a message
                </Link>
              </li>
            ) : null}
          </ul>
          {social.length ? (
            <ul className="mt-4 flex flex-wrap gap-3 text-sm">
              {social.map(([k, url]) => (
                <li key={k}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-saffron-dark hover:underline">
                    {socialNames[k] ?? k}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      <div className="border-t border-line">
        <p className="container-page py-5 text-xs text-muted">
          © {new Date().getFullYear()} {business.name}. {business.gstin ? `GSTIN ${business.gstin}. ` : ""}Prices in Indian Rupees.
        </p>
      </div>
    </footer>
  );
}
