import type { Metadata } from "next";
import { getDb } from "@/server/db/client";
import { siteData } from "@/server/site";
import { publishedFaqs } from "@/server/services/content";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { EmptyState } from "@/components/shop/empty-state";
import { FaqList } from "@/components/shop/faq-list";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Questions and answers",
  description: "Answers about ordering puja flowers online, delivery areas and slots, payment and bulk orders for mandirs.",
  alternates: { canonical: "/faq" },
};

const TOPICS: { key: "ordering" | "delivery" | "payment" | "bulk" | "general" | "product"; title: string }[] = [
  { key: "ordering", title: "Ordering" },
  { key: "delivery", title: "Delivery" },
  { key: "payment", title: "Payment" },
  { key: "bulk", title: "Bulk orders" },
  { key: "product", title: "Flowers" },
  { key: "general", title: "Other questions" },
];

export default async function FaqPage() {
  const site = await siteData();
  const faqs = (await publishedFaqs(getDb())).filter((f) => !f.categoryId);
  return (
    <div className="container-page max-w-3xl py-6">
      <Breadcrumbs baseUrl={site.appUrl} items={[{ name: "Questions and answers", href: "/faq" }]} />
      <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Questions and answers</h1>
      {faqs.length ? (
        <div className="mt-6 space-y-8">
          {TOPICS.map((t) => {
            const list = faqs.filter((f) => f.topic === t.key);
            return list.length ? (
              <section key={t.key} aria-labelledby={`faq-${t.key}`}>
                <h2 id={`faq-${t.key}`} className="section-title mb-3">
                  {t.title}
                </h2>
                <FaqList faqs={list} />
              </section>
            ) : null;
          })}
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState title="No questions yet" action={{ label: "Contact us", href: "/contact" }} />
        </div>
      )}
      {faqs.length ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) }).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}
    </div>
  );
}
