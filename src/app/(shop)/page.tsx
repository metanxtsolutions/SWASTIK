import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarClock, ClipboardList, IndianRupee, MapPin, PhoneCall, Sparkles, Truck, UserX } from "lucide-react";
import { getDb } from "@/server/db/client";
import { siteData } from "@/server/site";
import { bestsellers, listCollections, listProducts, mediaUrl } from "@/server/services/catalog";
import { activeBanners, listArticles, publishedFaqs, publishedTestimonials } from "@/server/services/content";
import { listActiveZones } from "@/server/services/delivery";
import { illustrationUrl } from "@/lib/illustrations";
import { formatINR } from "@/lib/money";
import { CategoryTiles } from "@/components/shop/category-tiles";
import { DeliveryCheck } from "@/components/shop/delivery-check";
import { FaqList } from "@/components/shop/faq-list";
import { ProductRail } from "@/components/shop/product-card";
import { Section } from "@/components/shop/section";

export const revalidate = 300;

const HERO_ART = illustrationUrl("hero");
const WHY_ICONS = [UserX, IndianRupee, CalendarClock, ClipboardList, Truck, Sparkles];

export default async function HomePage() {
  const db = getDb();
  const site = await siteData();
  const { homepage, business } = site.settings;
  const s = homepage.sections;
  const bySlug = (slug: string) => site.categories.find((c) => c.slug === slug);

  const dailyCategory = homepage.dailyCategoryId ? site.categories.find((c) => c.id === homepage.dailyCategoryId) : bySlug("daily-puja-flower-packs");
  const garlandCategories = homepage.garlandCategoryIds.length ? site.categories.filter((c) => homepage.garlandCategoryIds.includes(c.id)) : [bySlug("flower-garlands"), bySlug("mixed-flower-bundles")].filter((c) => !!c);

  const [heroBanners, offerBanners, popular, daily, garlands, collections, best, zones, testimonials, guides, faqs] = await Promise.all([
    activeBanners(db, "hero"),
    s.offers ? activeBanners(db, "offer") : Promise.resolve([]),
    homepage.popularProductIds.length ? listProducts(db, { ids: homepage.popularProductIds, limit: 8 }) : listProducts(db, { featured: true, limit: 8 }),
    s.daily && dailyCategory ? listProducts(db, { categoryId: dailyCategory.id, limit: 8 }) : Promise.resolve(null),
    s.garlands && garlandCategories.length ? Promise.all(garlandCategories.map((c) => listProducts(db, { categoryId: c!.id, limit: 4 }))) : Promise.resolve([]),
    s.collections ? listCollections(db) : Promise.resolve([]),
    s.bestsellers ? bestsellers(db, 8) : Promise.resolve([]),
    s.delivery ? listActiveZones(db) : Promise.resolve([]),
    s.reviews ? publishedTestimonials(db, 3) : Promise.resolve([]),
    s.guides ? listArticles(db, { limit: 3 }) : Promise.resolve([]),
    s.faq ? publishedFaqs(db, { topics: ["ordering", "delivery", "payment"] }) : Promise.resolve([]),
  ]);

  const featuredCats = homepage.featuredCategoryIds.length ? homepage.featuredCategoryIds.map((id) => site.categories.find((c) => c.id === id)).filter((c) => !!c) : site.categories;
  const garlandItems = garlands.flatMap((r) => r.items).slice(0, 8);
  const hasProducts = site.categories.length > 0;
  const hero = heroBanners[0];

  return (
    <>
      {/* Hero */}
      <section className="container-page pt-4 sm:pt-6">
        <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-marigold-soft via-cream to-saffron-soft">
          <div className="grid items-center gap-6 p-5 sm:p-8 md:grid-cols-2 lg:px-12 lg:py-10">
            <div className="relative z-10">
              <p className="chip bg-paper/80 text-saffron-dark">
                <MapPin aria-hidden className="h-3.5 w-3.5" />
                {hero?.eyebrow || homepage.heroEyebrow}
              </p>
              <h1 className="mt-3 text-[1.85rem] font-semibold leading-[1.1] text-ink sm:text-5xl lg:text-[3.25rem]">{hero?.title || homepage.heroTitle}</h1>
              <p className="mt-3 max-w-xl text-[0.95rem] text-ink-soft sm:mt-4 sm:text-lg">{hero?.subtitle || homepage.heroSubtitle}</p>
              <div className="mt-5 flex flex-wrap gap-2.5 sm:mt-6 sm:gap-3">
                <Link href={hero?.ctaHref || homepage.heroCtaHref || "/shop"} className="btn btn-primary px-5 text-base sm:px-6">
                  {hero?.ctaLabel || homepage.heroCtaLabel || "Shop flowers"}
                  <ArrowRight aria-hidden className="h-4 w-4" />
                </Link>
                <Link href="/bulk-orders" className="btn btn-secondary px-5 text-base sm:px-6">
                  Bulk orders
                </Link>
              </div>
            </div>
            <div className={`relative mx-auto aspect-[5/4] w-full max-w-lg overflow-hidden rounded-2xl ${hero?.image ? "" : "hidden md:block"}`}>
              {hero?.image ? (
                <Image src={mediaUrl(hero.image)} alt={hero.image.alt} fill priority sizes="(min-width: 768px) 45vw, 92vw" className="object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={HERO_ART} alt="Illustration of a marigold garland, lotus and puja flowers" className="h-full w-full object-cover" width={800} height={640} fetchPriority="high" />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Delivery check, right under the hero so customers know straight away */}
      <section aria-labelledby="pin-title" className="container-page mt-4">
        <div className="card grid gap-4 p-4 sm:p-5 md:grid-cols-[1fr_1.2fr] md:items-center">
          <div>
            <h2 id="pin-title" className="font-sans text-lg font-semibold">
              Do we deliver to you?
            </h2>
            <p className="text-sm text-muted">Enter your PIN code to see delivery dates and charges for your area.</p>
          </div>
          <DeliveryCheck />
        </div>
      </section>

      {!hasProducts ? (
        <section className="container-page py-10">
          <div className="card p-6 text-center sm:p-10">
            <h2 className="section-title">Our flower catalogue is being set up</h2>
            <p className="mx-auto mt-2 max-w-xl text-ink-soft">
              Online ordering opens soon. In the meantime you can <Link href="/contact" className="font-semibold text-saffron-dark underline">contact us</Link> or send a{" "}
              <Link href="/bulk-orders" className="font-semibold text-saffron-dark underline">bulk enquiry</Link>.
            </p>
          </div>
        </section>
      ) : null}

      {s.categories && featuredCats.length ? (
        <Section id="categories" title="Shop by flower" href="/shop" hrefLabel="All flowers">
          <CategoryTiles categories={featuredCats} />
        </Section>
      ) : null}

      {s.popular && popular.items.length ? (
        <Section id="popular" title="Popular puja flowers" intro="Flowers our customers order most often for daily and festival pujas." href="/shop">
          <ProductRail products={popular.items} />
        </Section>
      ) : null}

      {daily?.items.length && dailyCategory ? (
        <Section id="daily" title="Daily puja essentials" intro={dailyCategory.summary} href={`/category/${dailyCategory.slug}`}>
          <ProductRail products={daily.items} />
        </Section>
      ) : null}

      {garlandItems.length ? (
        <Section id="garlands" title="Garlands and bundles" href={garlandCategories[0] ? `/category/${garlandCategories[0].slug}` : "/shop"}>
          <ProductRail products={garlandItems} />
        </Section>
      ) : null}

      {collections.length ? (
        <Section id="collections" title="Festival and occasion collections" intro="Flowers grouped for the pujas and festivals coming up.">
          <CategoryTiles categories={collections} basePath="/collections" />
        </Section>
      ) : null}

      {best.length ? (
        <Section id="bestsellers" title="Bestsellers" href="/shop">
          <ProductRail products={best} />
        </Section>
      ) : null}

      {offerBanners.length ? (
        <Section id="offers" title="Current offers">
          <ul className="grid gap-4 md:grid-cols-2">
            {offerBanners.map((b) => (
              <li key={b.id} className="card flex overflow-hidden">
                {b.image ? (
                  <span className="relative w-2/5 shrink-0">
                    <Image src={mediaUrl(b.image)} alt={b.image.alt} fill sizes="(min-width: 768px) 20vw, 40vw" className="object-cover" />
                  </span>
                ) : null}
                <div className="flex flex-col justify-center p-5">
                  {b.eyebrow ? <p className="text-xs font-bold uppercase tracking-wider text-kumkum">{b.eyebrow}</p> : null}
                  <h3 className="mt-1 text-xl font-semibold">{b.title}</h3>
                  {b.subtitle ? <p className="mt-1 text-sm text-ink-soft">{b.subtitle}</p> : null}
                  {b.ctaLabel && b.ctaHref ? (
                    <Link href={b.ctaHref} className="btn btn-primary btn-sm mt-3 self-start">
                      {b.ctaLabel}
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {s.why && homepage.whyItems.length ? (
        <Section id="why" title={homepage.whyTitle}>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {homepage.whyItems.map((w, i) => {
              const Icon = WHY_ICONS[i % WHY_ICONS.length];
              return (
                <li key={w.title} className="card p-5">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-saffron-soft text-saffron-dark">
                    <Icon aria-hidden className="h-5 w-5" />
                  </span>
                  <h3 className="mt-3 font-sans text-base font-semibold">{w.title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{w.body}</p>
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      {s.delivery && zones.length ? (
        <Section id="delivery" title="Delivery areas" intro="We currently deliver to these areas. Delivery charges are shown in your cart before you pay." href="/delivery" hrefLabel="Delivery information">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {zones.map((z) => (
              <li key={z.id} className="card p-5">
                <h3 className="font-sans text-base font-semibold">{z.name}</h3>
                <p className="mt-1 text-sm text-muted">PIN {z.pincodes.map((p) => p.pincode).join(", ")}</p>
                <p className="mt-2 text-sm text-ink-soft">
                  Delivery {z.deliveryFeePaise ? formatINR(z.deliveryFeePaise) : "free"}
                  {z.freeDeliveryAbovePaise && z.deliveryFeePaise ? `, free above ${formatINR(z.freeDeliveryAbovePaise)}` : ""}
                  {z.slots.length ? `. Slots: ${z.slots.join("; ")}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {s.bulk ? (
        <section aria-labelledby="bulk-title" className="container-page py-8 sm:py-10">
          <div className="grid gap-6 overflow-hidden rounded-3xl bg-kumkum p-6 text-white sm:p-10 md:grid-cols-[1.4fr_1fr] md:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-white/80">For mandirs, pandits and puja committees</p>
              <h2 id="bulk-title" className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
                {homepage.bulkTitle}
              </h2>
              <p className="mt-3 max-w-xl text-white/90">{homepage.bulkBody}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:flex-col md:items-end">
              <Link href="/bulk-orders#enquiry" className="btn bg-paper px-6 text-base text-kumkum hover:bg-cream">
                Request a bulk quote
              </Link>
              {business.phone ? (
                <a href={`tel:${business.phone.replace(/[^\d+]/g, "")}`} className="btn border border-white/40 px-6 text-base text-white hover:bg-white/10">
                  <PhoneCall aria-hidden className="h-4 w-4" />
                  Call {business.phone}
                </a>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {testimonials.length ? (
        <Section id="reviews" title="What customers say">
          <ul className="grid gap-4 md:grid-cols-3">
            {testimonials.map((t) => (
              <li key={t.id} className="card p-5">
                <figure>
                  <blockquote className="text-ink-soft">“{t.body}”</blockquote>
                  <figcaption className="mt-3 text-sm font-semibold text-ink">
                    {t.customerName}
                    {t.locality ? <span className="font-normal text-muted">, {t.locality}</span> : null}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {guides.length ? (
        <Section id="guides" title="Flower guides" href="/guides" hrefLabel="All guides">
          <ul className="grid gap-4 md:grid-cols-3">
            {guides.map((g) => (
              <li key={g.id} className="card p-5">
                <h3 className="text-lg font-semibold leading-snug">
                  <Link href={`/guides/${g.slug}`} className="hover:text-saffron-dark">
                    {g.title}
                  </Link>
                </h3>
                <p className="mt-2 text-sm text-ink-soft">{g.excerpt}</p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {faqs.length ? (
        <Section id="faq" title="Questions and answers" href="/faq" hrefLabel="All questions">
          <div className="max-w-3xl">
            <FaqList faqs={faqs.slice(0, 6)} />
          </div>
        </Section>
      ) : null}
    </>
  );
}
