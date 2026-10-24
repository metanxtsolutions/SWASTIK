import type { Metadata } from "next";
import { getDb } from "@/server/db/client";
import { notFoundOrRedirect } from "@/server/not-found";
import { siteData } from "@/server/site";
import { listProducts } from "@/server/services/catalog";
import { listArticles, publishedFaqs } from "@/server/services/content";
import { ListingPage } from "@/components/shop/listing-page";

export const revalidate = 300;
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

async function load(slug: string) {
  const site = await siteData();
  const category = site.categories.find((c) => c.slug === slug);
  return { site, category };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { category, site } = await load(slug);
  if (!category) return {};
  const where = site.settings.business.locality || "Rishra";
  return {
    title: category.seoTitle || `${category.name}: buy online in ${where}`,
    description: category.seoDescription || `${category.summary || `Buy ${category.name.toLowerCase()} for puja`} Order online from ${site.settings.business.name} with clear prices and delivery slots.`.slice(0, 165),
    alternates: { canonical: `/category/${category.slug}` },
    openGraph: { title: category.name, url: `/category/${category.slug}` },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { category, site } = await load(slug);
  if (!category) return notFoundOrRedirect(`/category/${slug}`);
  const db = getDb();
  const [{ items }, faqs, guides] = await Promise.all([listProducts(db, { categoryId: category.id, limit: 120 }), publishedFaqs(db, { categoryId: category.id }), listArticles(db, { categoryId: category.id, limit: 3 })]);
  return (
    <ListingPage
      baseUrl={site.appUrl}
      crumbs={[
        { name: "Shop", href: "/shop" },
        { name: category.name, href: `/category/${category.slug}` },
      ]}
      title={category.name}
      summary={category.summary}
      intro={category.intro}
      products={items}
      sortHref={`/shop?category=${category.slug}`}
      faqs={faqs}
      guides={guides}
      siblings={site.categories.filter((c) => c.id !== category.id)}
      siblingBase="/category"
      canonicalPath={`/category/${category.slug}`}
    />
  );
}
