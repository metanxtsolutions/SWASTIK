import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getDb } from "@/server/db/client";
import { siteData } from "@/server/site";
import { findRedirect, publishedPage } from "@/server/services/content";
import { formatDate } from "@/lib/dates";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { Markdown, markdownToText } from "@/components/markdown";

export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}

/**
 * Owner-managed pages (about, policies) at /<slug>, then redirects the owner set
 * up in the admin panel, and otherwise the 404 page.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  if (slug.length !== 1) return {};
  const page = await publishedPage(getDb(), slug[0]);
  if (!page) return {};
  return { title: page.seoTitle || page.title, description: (page.seoDescription || markdownToText(page.body)).slice(0, 165), alternates: { canonical: `/${page.slug}` } };
}

export default async function ContentPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const db = getDb();
  if (slug.length === 1) {
    const page = await publishedPage(db, slug[0]);
    if (page) {
      const site = await siteData();
      return (
        <div className="container-page max-w-3xl py-6">
          <Breadcrumbs baseUrl={site.appUrl} items={[{ name: page.title, href: `/${page.slug}` }]} />
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{page.title}</h1>
          <p className="mt-2 text-sm text-muted">Last updated {formatDate(page.updatedAt)}</p>
          <div className="mt-6">
            <Markdown source={page.body} />
          </div>
        </div>
      );
    }
  }
  const path = `/${slug.map((s) => decodeURIComponent(s)).join("/")}`;
  const r = await findRedirect(db, path);
  if (r) {
    if (r.permanent) permanentRedirect(r.toPath);
    redirect(r.toPath);
  }
  notFound();
}
