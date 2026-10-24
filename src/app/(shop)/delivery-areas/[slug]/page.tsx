import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/server/db/client";
import { siteData } from "@/server/site";
import { listLandingZones } from "@/server/services/delivery";
import { formatINR } from "@/lib/money";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { CategoryTiles } from "@/components/shop/category-tiles";
import { DeliveryCheck } from "@/components/shop/delivery-check";
import { Markdown, markdownToText } from "@/components/markdown";

export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}

async function zoneFor(slug: string) {
  return (await listLandingZones(getDb())).find((z) => z.slug === slug) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const z = await zoneFor((await params).slug);
  if (!z) return {};
  return { title: z.landingTitle || `Puja flower delivery in ${z.name}`, description: markdownToText(z.landingContent).slice(0, 160), alternates: { canonical: `/delivery-areas/${z.slug}` } };
}

/** Published only for active zones where the owner has written real local content. */
export default async function DeliveryAreaPage({ params }: { params: Promise<{ slug: string }> }) {
  const zone = await zoneFor((await params).slug);
  if (!zone) notFound();
  const site = await siteData();
  return (
    <div className="container-page max-w-5xl py-6">
      <Breadcrumbs baseUrl={site.appUrl} items={[{ name: "Delivery information", href: "/delivery" }, { name: zone.name, href: `/delivery-areas/${zone.slug}` }]} />
      <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{zone.landingTitle || `Puja flower delivery in ${zone.name}`}</h1>
      <p className="mt-2 text-ink-soft">
        PIN {zone.pincodes.map((p) => p.pincode).join(", ")}. Delivery {zone.deliveryFeePaise ? formatINR(zone.deliveryFeePaise) : "free"}
        {zone.slots.length ? `. Slots: ${zone.slots.join("; ")}` : ""}.
      </p>
      <div className="card mt-5 p-5">
        <DeliveryCheck />
      </div>
      <article className="mt-8 max-w-3xl">
        <Markdown source={zone.landingContent} />
      </article>
      {site.categories.length ? (
        <section className="mt-10">
          <h2 className="section-title mb-4">Shop by flower</h2>
          <CategoryTiles categories={site.categories} />
        </section>
      ) : null}
      <p className="mt-8">
        <Link href="/shop" className="btn btn-primary">
          Shop all flowers
        </Link>
      </p>
    </div>
  );
}
