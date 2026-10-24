# SEO and AI search strategy

Nothing here guarantees rankings in Google or citations by AI assistants. The aim is a site that search engines can crawl and understand, with accurate, useful content that matches what customers search for.

## Technical SEO (implemented)

| Item | Where |
|---|---|
| Server-rendered pages with incremental regeneration | All public pages; content is in the HTML, not loaded later by JavaScript |
| Unique titles and descriptions | `generateMetadata` on every page; owner overrides for products, categories, collections, pages, guides; site defaults in Settings > Search engines |
| Canonical URLs | `alternates.canonical` on every indexable page; filtered `/shop` views are `noindex, follow` and point to `/shop` |
| Clean URLs | `/category/marigold-flowers`, `/product/marigold-flowers-loose`, `/collections/durga-puja-flowers`, `/guides/...`, `/delivery-areas/...`, `/<page-slug>` |
| XML sitemap | `/sitemap.xml`: only published products, categories and collections that have products, published guides and pages, and published area pages |
| Robots | `/robots.txt` allows public pages and disallows `/admin`, `/api/`, `/cart`, `/checkout`, `/order/`, `/track`, `/pay/`, `/search`. Preview and development sites disallow everything and send `noindex` |
| Private pages | Cart, checkout, order, tracking, test payment and admin pages are `noindex` (metadata and `X-Robots-Tag`) |
| Breadcrumbs | Visible breadcrumbs plus `BreadcrumbList` structured data |
| Headings | One `h1` per page, sections with `h2` |
| Internal links | Header categories, footer, related products, category siblings, guides linking to categories and the bulk page, category pages listing related guides |
| Images | Descriptive file names (from the product slug), alt text fields for every photo, Next.js image optimisation (AVIF/WebP, responsive sizes, lazy loading below the fold) |
| Open Graph | Site name, locale `en_IN`, per-page titles and descriptions, product and guide images, an owner-uploaded sharing image |
| Redirects | Admin > Website content > Redirects; applied to missing products, categories, collections, guides and other paths |
| 404 | Branded page with links back into the shop, returning HTTP 404 |
| Search Console | Verification code field; submit `/sitemap.xml` |
| Performance | Self-hosted variable fonts, no third-party scripts except Razorpay on payment, optimised images. See [testing.md](testing.md) for measured Lighthouse scores |

## Structured data (only when accurate)

| Type | When |
|---|---|
| `Product` with `Offer` or `AggregateOffer` | Published products; price in INR, availability from real stock, SKU when there is one option. Matches what the page shows |
| `BreadcrumbList` | Pages with breadcrumbs |
| `WebSite` with `SearchAction`, `Organization` | Every storefront page |
| `CollectionPage` with `ItemList` | Category and collection pages |
| `Article` | Published guides |
| `FAQPage` | The FAQ page |
| `Florist` (LocalBusiness) | Contact page, **only** after the owner ticks "details are correct" and has entered an address and phone |

No reviews or ratings markup is produced: there are no verified reviews yet, and self-published review markup is not eligible for rich results.

## Local SEO

1. Enter the exact business name, address, phone and hours in Settings, identical to the Google Business Profile, then tick "details are correct".
2. Create or claim the Google Business Profile for Swastik in Rishra and link it under Social links.
3. Publish **area landing pages** only for areas genuinely served, with unique local content (localities, delivery timings, temples supplied, how to order). The admin refuses to publish pages shorter than 300 characters.
4. Keep delivery areas current so customers outside them are told honestly.

## Content plan

Starter guides are in Admin > Website content > Guides as **drafts** for the owner to review, correct and publish:

- Flowers commonly used in daily puja
- How to choose fresh puja flowers
- How to keep puja flowers fresh until your puja
- Planning flower quantities for a mandir or community puja
- How to order puja flowers in bulk for a mandir

Suggested next guides (write from real experience): flower availability through the seasons in Hooghly, flowers for Durga Puja, Kali Puja, Lakshmi Puja and Saraswati Puja, and how to order puja flowers in Rishra and nearby areas once those areas are active.

Rules for content: culturally respectful, factual, no invented religious rules, no promised spiritual outcomes or health benefits, no sourcing claims the business cannot back up.

## AI search readiness

- Clear statements of what Swastik sells, where it delivers and how to order, in plain HTML on the home, delivery, bulk and FAQ pages.
- Consistent business name and details everywhere (one Settings source).
- Concise question-and-answer content (FAQs) and practical guides.
- `/llms.txt`: an optional plain-text summary with links to the main pages, generated from live data. It supplements, and does not replace, normal SEO.
- Legitimate crawlers can reach every public page; there are no hidden keyword blocks or misleading markup.
