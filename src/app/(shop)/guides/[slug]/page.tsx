import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getDb } from "@/server/db/client";
import { notFoundOrRedirect } from "@/server/not-found";
import { siteData } from "@/server/site";
import { listProducts, mediaUrl } from "@/server/services/catalog";
import { getArticle, listArticles } from "@/server/services/content";
import { formatDate } from "@/lib/dates";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { JsonLd } from "@/components/shop/json-ld";
import { Markdown, markdownToText } from "@/components/markdown";
import { ProductRail } from "@/components/shop/product-card";

export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = await getArticle(getDb(), (await params).slug);
  if (!a) return {};
  return {
    title: a.seoTitle || a.title,
    description: (a.seoDescription || a.excerpt || markdownToText(a.body)).slice(0, 165),
    alternates: { canonical: `/guides/${a.slug}` },
    openGraph: { type: "article", title: a.title, publishedTime: a.publishedAt?.toISOString(), modifiedTime: a.updatedAt.toISOString(), ...(a.cover ? { images: [{ url: mediaUrl(a.cover) }] } : {}) },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const db = getDb();
  const { slug } = await params;
  const a = await getArticle(db, slug);
  if (!a) return notFoundOrRedirect(`/guides/${slug}`);
  const site = await siteData();
  const [more, products] = await Promise.all([listArticles(db, { limit: 4 }), a.categoryId ? listProducts(db, { categoryId: a.categoryId, limit: 4 }) : Promise.resolve(null)]);
  return (
    <div className="container-page py-6">
      <Breadcrumbs baseUrl={site.appUrl} items={[{ name: "Guides", href: "/guides" }, { name: a.title, href: `/guides/${a.slug}` }]} />
      <article className="mx-auto mt-4 max-w-3xl">
        <header>
          <h1 className="text-3xl font-semibold leading-tight sm:text-5xl">{a.title}</h1>
          {a.excerpt ? <p className="mt-3 text-lg text-ink-soft">{a.excerpt}</p> : null}
          <p className="mt-3 text-sm text-muted">
            {a.authorName}
            {a.publishedAt ? `, ${formatDate(a.publishedAt)}` : ""}
            {a.updatedAt && a.publishedAt && a.updatedAt.getTime() - a.publishedAt.getTime() > 86_400_000 ? `. Updated ${formatDate(a.updatedAt)}` : ""}
          </p>
        </header>
        {a.cover ? (
          <span className="relative mt-6 block aspect-[16/9] overflow-hidden rounded-3xl bg-sand">
            <Image src={mediaUrl(a.cover)} alt={a.cover.alt} fill priority sizes="(min-width: 768px) 768px, 100vw" className="object-cover" />
          </span>
        ) : null}
        <div className="mt-8">
          <Markdown source={a.body} />
        </div>
        {a.categorySlug ? (
          <p className="mt-8">
            <Link href={`/category/${a.categorySlug}`} className="btn btn-primary">
              Shop {a.categoryName}
            </Link>
          </p>
        ) : null}
      </article>
      {products?.items.length ? (
        <section className="mt-12">
          <h2 className="section-title mb-4">Flowers for this</h2>
          <ProductRail products={products.items} />
        </section>
      ) : null}
      {more.filter((m) => m.slug !== a.slug).length ? (
        <section className="mt-12">
          <h2 className="section-title mb-4">More guides</h2>
          <ul className="grid gap-4 md:grid-cols-3">
            {more
              .filter((m) => m.slug !== a.slug)
              .slice(0, 3)
              .map((m) => (
                <li key={m.id} className="card p-5">
                  <Link href={`/guides/${m.slug}`} className="text-lg font-semibold hover:text-saffron-dark">
                    {m.title}
                  </Link>
                  <p className="mt-1 text-sm text-ink-soft">{m.excerpt}</p>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: a.title,
          description: a.excerpt || markdownToText(a.body).slice(0, 200),
          author: { "@type": "Organization", name: a.authorName },
          publisher: { "@type": "Organization", name: site.settings.business.name, logo: { "@type": "ImageObject", url: `${site.appUrl}/icon.svg` } },
          datePublished: a.publishedAt?.toISOString(),
          dateModified: a.updatedAt.toISOString(),
          mainEntityOfPage: new URL(`/guides/${a.slug}`, site.appUrl).toString(),
          ...(a.cover ? { image: new URL(mediaUrl(a.cover), site.appUrl).toString() } : {}),
        }}
      />
    </div>
  );
}
