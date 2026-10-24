import type { Metadata } from "next";
import { getDb } from "@/server/db/client";
import { notFoundOrRedirect } from "@/server/not-found";
import { siteData } from "@/server/site";
import { getCollection, listCollections, listProducts } from "@/server/services/catalog";
import { ListingPage } from "@/components/shop/listing-page";

export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCollection(getDb(), slug);
  if (!c) return {};
  return {
    title: c.seoTitle || `${c.name} flowers`,
    description: c.seoDescription || `${c.summary || `Flowers for ${c.name}.`} Order online from Swastik with clear prices and delivery slots.`.slice(0, 165),
    alternates: { canonical: `/collections/${c.slug}` },
  };
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getDb();
  const [site, collection, all] = await Promise.all([siteData(), getCollection(db, slug), listCollections(db)]);
  if (!collection) return notFoundOrRedirect(`/collections/${slug}`);
  const { items } = await listProducts(db, { collectionId: collection.id, limit: 120 });
  return (
    <ListingPage
      baseUrl={site.appUrl}
      crumbs={[
        { name: "Shop", href: "/shop" },
        { name: collection.name, href: `/collections/${collection.slug}` },
      ]}
      title={`${collection.name} flowers`}
      summary={collection.summary}
      intro={collection.intro}
      products={items}
      sortHref={`/shop?collection=${collection.slug}`}
      faqs={[]}
      guides={[]}
      siblings={all.filter((c) => c.id !== collection.id)}
      siblingBase="/collections"
      canonicalPath={`/collections/${collection.slug}`}
    />
  );
}
