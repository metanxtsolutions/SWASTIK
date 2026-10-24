import Link from "next/link";
import { Building2 } from "lucide-react";
import type { SiteData } from "@/server/site";
import { Logo } from "../logo";
import { CartButton, PincodeChip, SearchBox } from "./header-client";

export function SiteHeader({ site }: { site: SiteData }) {
  const { business, homepage } = site.settings;
  const nav = site.categories.slice(0, 8);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/95 backdrop-blur supports-[backdrop-filter]:bg-cream/85">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      {site.nonProduction ? (
        <div className="bg-info text-center text-xs font-medium text-white">
          <p className="container-page py-1.5">
            {site.stage === "preview" ? "Preview site" : "Development site"}: sample products and test payments only. Orders placed here are not delivered.
          </p>
        </div>
      ) : null}
      {homepage.announcementEnabled && homepage.announcementText ? (
        <div className="bg-kumkum text-center text-sm text-white">
          <p className="container-page py-2">
            {homepage.announcementHref ? (
              <Link href={homepage.announcementHref} className="underline-offset-2 hover:underline">
                {homepage.announcementText}
              </Link>
            ) : (
              homepage.announcementText
            )}
          </p>
        </div>
      ) : null}
      <div className="container-page flex h-16 items-center gap-2 md:h-[4.5rem] md:gap-5">
        <Link href="/" className="shrink-0">
          <Logo name={business.name} tagline={business.tagline} />
        </Link>
        <SearchBox className="hidden flex-1 md:block" id="search-desktop" />
        <div className="ml-auto flex min-w-0 items-center gap-0.5 sm:gap-1 md:ml-0">
          <PincodeChip />
          <Link href="/bulk-orders" className="hidden h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-ink hover:bg-sand lg:inline-flex">
            <Building2 aria-hidden className="h-5 w-5" />
            Bulk orders
          </Link>
          <CartButton />
        </div>
      </div>
      <div className="container-page pb-3 md:hidden">
        <SearchBox id="search-mobile" />
      </div>
      {nav.length ? (
        <nav aria-label="Categories" className="border-t border-line/70">
          <ul className="container-page no-scrollbar flex gap-1 overflow-x-auto py-1.5 text-sm">
            <li>
              <Link href="/shop" className="inline-flex h-9 items-center whitespace-nowrap rounded-full px-3 font-semibold text-ink hover:bg-sand">
                All flowers
              </Link>
            </li>
            {nav.map((c) => (
              <li key={c.id}>
                <Link href={`/category/${c.slug}`} className="inline-flex h-9 items-center whitespace-nowrap rounded-full px-3 text-ink-soft hover:bg-sand hover:text-ink">
                  {c.name}
                </Link>
              </li>
            ))}
            <li className="md:hidden">
              <Link href="/bulk-orders" className="inline-flex h-9 items-center whitespace-nowrap rounded-full px-3 text-ink-soft hover:bg-sand">
                Bulk orders
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
