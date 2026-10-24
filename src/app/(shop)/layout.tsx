import type { Metadata } from "next";
import { siteData } from "@/server/site";
import { mediaUrl } from "@/server/services/catalog";
import { getDb } from "@/server/db/client";
import { media } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { SiteHeader } from "@/components/shop/header";
import { SiteFooter } from "@/components/shop/footer";
import { MobileNav, Toaster } from "@/components/shop/header-client";
import { JsonLd } from "@/components/shop/json-ld";

export async function generateMetadata(): Promise<Metadata> {
  const site = await siteData();
  const { seo, business } = site.settings;
  let ogImage: string | undefined;
  if (seo.ogImageId) {
    const [m] = await getDb().select().from(media).where(eq(media.id, seo.ogImageId));
    if (m) ogImage = mediaUrl(m);
  }
  return {
    title: { default: seo.defaultTitle, template: seo.titleTemplate.includes("%s") ? seo.titleTemplate : `%s | ${business.name}` },
    description: seo.defaultDescription,
    openGraph: { type: "website", siteName: business.name, locale: "en_IN", ...(ogImage ? { images: [{ url: ogImage }] } : {}) },
    twitter: { card: ogImage ? "summary_large_image" : "summary" },
    robots: site.nonProduction ? { index: false, follow: false } : undefined,
    verification: seo.googleSiteVerification ? { google: seo.googleSiteVerification } : undefined,
  };
}

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const site = await siteData();
  const { business, seo } = site.settings;
  return (
    <>
      <SiteHeader site={site} />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <SiteFooter site={site} />
      <MobileNav />
      <Toaster />
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: business.name,
            url: site.appUrl,
            description: seo.defaultDescription,
            potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${site.appUrl}/search?q={search_term_string}` }, "query-input": "required name=search_term_string" },
          },
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: business.name,
            url: site.appUrl,
            logo: `${site.appUrl}/icon.svg`,
            ...(business.email ? { email: business.email } : {}),
            ...(business.detailsVerified && business.phone ? { telephone: business.phone } : {}),
            sameAs: Object.values(business.social).filter(Boolean),
          },
        ]}
      />
    </>
  );
}
