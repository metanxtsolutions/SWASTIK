import type { Metadata } from "next";
import Link from "next/link";
import { Leaf, Sparkles } from "lucide-react";
import { getDb } from "@/server/db/client";
import { notFoundOrRedirect } from "@/server/not-found";
import { siteData } from "@/server/site";
import { getProduct, mediaUrl, relatedProducts } from "@/server/services/catalog";
import { publishedFaqs } from "@/server/services/content";
import { formatINR } from "@/lib/money";
import { AddToCart } from "@/components/shop/add-to-cart";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { DeliveryCheck } from "@/components/shop/delivery-check";
import { FaqList } from "@/components/shop/faq-list";
import { JsonLd } from "@/components/shop/json-ld";
import { ProductGallery } from "@/components/shop/product-gallery";
import { ProductRail } from "@/components/shop/product-card";

export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}

async function load(slug: string) {
  const site = await siteData();
  const product = await getProduct(getDb(), slug, { lowStockThreshold: site.settings.checkout.lowStockThreshold });
  return { site, product };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { product, site } = await load(slug);
  if (!product) return {};
  const v = product.variants.find((x) => x.available) ?? product.variants[0];
  const description = product.seoDescription || `${product.shortDescription || product.name}. ${v ? `${formatINR(v.pricePaise)} ${v.unitText}. ` : ""}Order online from ${site.settings.business.name} for delivery in your area.`;
  const image = product.images[0];
  return {
    title: product.seoTitle || product.name,
    description: description.slice(0, 165),
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: { title: product.name, description: description.slice(0, 200), url: `/product/${product.slug}`, ...(image ? { images: [{ url: mediaUrl(image), alt: image.alt }] } : {}) },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { product, site } = await load(slug);
  if (!product) return notFoundOrRedirect(`/product/${slug}`);
  const db = getDb();
  const [related, faqs] = await Promise.all([relatedProducts(db, product, 4), product.category ? publishedFaqs(db, { categoryId: product.category.id }) : Promise.resolve([])]);
  const generalFaqs = faqs.length ? [] : (await publishedFaqs(db, { topics: ["product", "delivery"] })).slice(0, 4);
  const allFaqs = [...faqs, ...generalFaqs];

  const available = product.variants.some((v) => v.available);
  const prices = product.variants.map((v) => v.pricePaise);
  const url = new URL(`/product/${product.slug}`, site.appUrl).toString();
  const availability = available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || product.shortDescription,
    url,
    ...(product.images.length ? { image: product.images.map((i) => new URL(mediaUrl(i), site.appUrl).toString()) } : {}),
    ...(product.variants.length === 1 ? { sku: product.variants[0].sku } : {}),
    ...(product.category ? { category: product.category.name } : {}),
    offers:
      product.variants.length === 1
        ? { "@type": "Offer", url, priceCurrency: "INR", price: (prices[0] / 100).toFixed(2), availability, itemCondition: "https://schema.org/NewCondition" }
        : { "@type": "AggregateOffer", url, priceCurrency: "INR", lowPrice: (Math.min(...prices) / 100).toFixed(2), highPrice: (Math.max(...prices) / 100).toFixed(2), offerCount: product.variants.length, availability },
  };

  return (
    <div className="container-page py-5 pb-28 md:pb-10">
      <Breadcrumbs
        baseUrl={site.appUrl}
        items={[{ name: "Shop", href: "/shop" }, ...(product.category ? [{ name: product.category.name, href: `/category/${product.category.slug}` }] : []), { name: product.name, href: `/product/${product.slug}` }]}
      />
      <div className="mt-4 grid gap-6 md:grid-cols-2 lg:gap-12">
        <ProductGallery images={product.images} name={product.name} />
        <div>
          {product.category ? (
            <Link href={`/category/${product.category.slug}`} className="text-sm font-semibold text-saffron-dark hover:underline">
              {product.category.name}
            </Link>
          ) : null}
          <h1 className="mt-1 text-3xl font-semibold leading-tight sm:text-4xl">{product.name}</h1>
          {product.shortDescription ? <p className="mt-2 text-lg text-ink-soft">{product.shortDescription}</p> : null}
          {product.isBestseller ? <p className="chip mt-3 bg-marigold-soft text-saffron-dark">Bestseller</p> : null}
          <div className="mt-5">
            <AddToCart productName={product.name} variants={product.variants} />
          </div>
          <section aria-labelledby="delivery-check" className="mt-6 rounded-2xl border border-line bg-paper p-4">
            <h2 id="delivery-check" className="mb-2 font-sans text-base font-semibold">
              Check delivery to your PIN code
            </h2>
            <DeliveryCheck productZoneIds={product.zoneIds} />
          </section>
          {product.collections.length ? (
            <p className="mt-4 text-sm text-muted">
              Part of:{" "}
              {product.collections.map((c, i) => (
                <span key={c.slug}>
                  {i ? ", " : ""}
                  <Link href={`/collections/${c.slug}`} className="font-medium text-saffron-dark hover:underline">
                    {c.name}
                  </Link>
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-8">
          {product.description ? (
            <section aria-labelledby="about">
              <h2 id="about" className="section-title mb-3">
                About this product
              </h2>
              <div className="prose-swastik">
                {product.description.split(/\n{2,}/).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </section>
          ) : null}
          {product.variants.length > 1 ? (
            <section aria-labelledby="options">
              <h2 id="options" className="section-title mb-3">
                Options and prices
              </h2>
              <table className="w-full overflow-hidden rounded-2xl border border-line bg-paper text-left text-sm">
                <thead className="bg-sand text-ink-soft">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-semibold">
                      Option
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">
                      Price
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">
                      Availability
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {product.variants.map((v) => (
                    <tr key={v.id}>
                      <td className="px-4 py-2.5">{v.label || "Standard"}</td>
                      <td className="px-4 py-2.5">
                        {formatINR(v.pricePaise)} {v.unitText}
                      </td>
                      <td className="px-4 py-2.5">{v.available ? "In stock" : "Out of stock"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
        </div>
        <div className="space-y-4">
          {product.usageInfo ? (
            <section aria-labelledby="usage" className="card p-5">
              <h2 id="usage" className="flex items-center gap-2 font-sans text-base font-semibold">
                <Sparkles aria-hidden className="h-4 w-4 text-saffron" />
                Used for
              </h2>
              <p className="mt-2 text-ink-soft">{product.usageInfo}</p>
            </section>
          ) : null}
          {product.careInfo ? (
            <section aria-labelledby="care" className="card p-5">
              <h2 id="care" className="flex items-center gap-2 font-sans text-base font-semibold">
                <Leaf aria-hidden className="h-4 w-4 text-leaf" />
                Keeping it fresh
              </h2>
              <p className="mt-2 text-ink-soft">{product.careInfo}</p>
            </section>
          ) : null}
        </div>
      </div>

      {allFaqs.length ? (
        <section aria-labelledby="product-faq" className="mt-10 max-w-3xl">
          <h2 id="product-faq" className="section-title mb-4">
            Questions
          </h2>
          <FaqList faqs={allFaqs} />
        </section>
      ) : null}

      {related.length ? (
        <section aria-labelledby="related" className="mt-12">
          <h2 id="related" className="section-title mb-4">
            You may also need
          </h2>
          <ProductRail products={related} />
        </section>
      ) : null}
      <JsonLd data={productLd} />
    </div>
  );
}
