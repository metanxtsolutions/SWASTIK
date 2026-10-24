import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getDb } from "@/server/db/client";
import { siteData } from "@/server/site";
import { mediaUrl } from "@/server/services/catalog";
import { listArticles } from "@/server/services/content";
import { formatDate } from "@/lib/dates";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { EmptyState } from "@/components/shop/empty-state";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Puja flower guides",
  description: "Practical guides to choosing, caring for and ordering puja flowers, and planning flowers for mandirs and religious events.",
  alternates: { canonical: "/guides" },
};

export default async function GuidesPage() {
  const site = await siteData();
  const guides = await listArticles(getDb());
  return (
    <div className="container-page py-6">
      <Breadcrumbs baseUrl={site.appUrl} items={[{ name: "Guides", href: "/guides" }]} />
      <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Puja flower guides</h1>
      <p className="mt-2 max-w-2xl text-lg text-ink-soft">Practical advice on choosing fresh flowers, keeping them fresh and planning flowers for larger pujas.</p>
      {guides.length ? (
        <ul className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {guides.map((g) => (
            <li key={g.id} className="card overflow-hidden">
              {g.cover ? (
                <span className="relative block aspect-[16/9] bg-sand">
                  <Image src={mediaUrl(g.cover)} alt={g.cover.alt} fill sizes="(min-width: 1024px) 400px, 100vw" className="object-cover" />
                </span>
              ) : null}
              <div className="p-5">
                <h2 className="text-xl font-semibold leading-snug">
                  <Link href={`/guides/${g.slug}`} className="hover:text-saffron-dark">
                    {g.title}
                  </Link>
                </h2>
                <p className="mt-2 text-sm text-ink-soft">{g.excerpt}</p>
                {g.publishedAt ? <p className="mt-3 text-xs text-muted">{formatDate(g.publishedAt)}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6">
          <EmptyState title="Guides coming soon" action={{ label: "Shop flowers", href: "/shop" }} />
        </div>
      )}
    </div>
  );
}
