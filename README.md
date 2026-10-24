# Swastik: puja flowers online

E-commerce website for **Swastik**, a puja flowers business starting in Rishra, Hooghly, West Bengal. Customers shop as guests, see clear prices per unit, pick a delivery date and slot, and pay online or (if the owner enables it) on delivery. Mandirs and other large buyers send bulk enquiries with several flower varieties. One master administrator runs everything from `/admin`.

> **Status: ready for launch preparation, not yet launched.** The code, tests and production build work locally. Live payments, email delivery, image storage, the production database and the Vercel deployment still need the business's own accounts and credentials. See [docs/launch-checklist.md](docs/launch-checklist.md).

## What is included

| Area | Highlights |
|---|---|
| Storefront | Home page (owner-configurable sections), shop with filters and sorting, categories, festival collections, product pages with options (250 g, 500 g, garland lengths), search with suggestions, guides, delivery information, FAQ, contact, policy pages, branded 404 |
| Cart and checkout | Guest cart saved in the browser; prices, stock, promo codes and delivery fees always recalculated on the server; delivery dates, slots, cut-offs, capacity and blackout dates; idempotent order placement; stock reserved in a locked transaction |
| Payments | Razorpay (Orders API, Standard Checkout, signature checks, webhooks, refunds) and a built-in test gateway that is refused in production. Cash on Delivery is off until the owner turns it on |
| Orders | Random order numbers, private order links, tracking by order number plus phone, status history, internal notes, cancellations with stock release, refunds, CSV export |
| Bulk orders | `/bulk-orders` landing page and enquiry form with multiple flower lines, spam protection, admin follow-up with quotation notes, conversion to a confirmed order, optional WhatsApp button |
| Admin | One master login (scrypt, hashed sessions, rate limiting, reset links, CLI recovery), dashboard, orders, bulk enquiries, products and photos, stock, categories, collections, delivery areas, promo codes, home page and content editors, settings, messages, activity log |
| SEO | Server-rendered pages, unique titles and descriptions, canonical URLs, sitemap, robots rules, structured data (Product, BreadcrumbList, Organization, WebSite, Article, FAQPage, Florist only after the owner verifies details), redirects, `llms.txt` |

## Stack

Next.js 15 (App Router, server actions) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL · Drizzle ORM with SQL migrations · Zod · Vitest · Playwright. Designed for Vercel. See [docs/architecture.md](docs/architecture.md).

## Local setup

Requirements: Node.js 20.18 or newer (22 recommended) and PostgreSQL 14 or newer.

```bash
npm install

# Database (example with a local Postgres superuser)
createuser -P swastik                  # development password: swastik
createdb -O swastik swastik_dev
createdb -O swastik swastik_test       # for npm test
createdb -O swastik swastik_e2e        # for npm run test:e2e

cp .env.example .env.local             # development defaults work as they are

npm run db:migrate                     # create tables
npm run db:seed                        # categories, FAQs, draft pages and guides, inactive Rishra zone
SEED_SAMPLE_DATA=true npm run db:seed:sample   # optional illustrative catalogue for trying the shop
npm run admin:create                   # the master administrator (prompts for email and password)

npm run dev                            # http://localhost:3000, admin at /admin
```

The sample catalogue uses illustrative prices and turns on a sample Rishra delivery area (PIN 712248) so checkout can be tried with the test gateway. It is refused when `APP_STAGE=production`.

## Checks

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript
npm test            # Vitest service tests against PostgreSQL (swastik_test)
npm run build       # production build (needs a migrated database: pages are prerendered from it)
npm run test:e2e    # Playwright: builds and runs the app on port 3200 against swastik_e2e
npm run check       # lint + typecheck + test + build
```

See [docs/testing.md](docs/testing.md) for what the tests cover and the latest results.

## Documentation

| Document | Contents |
|---|---|
| [business-requirements.md](docs/business-requirements.md) | Scope, decisions, assumptions and what is out of scope |
| [design-system.md](docs/design-system.md) | Colours, type, components, illustrations, responsive rules |
| [architecture.md](docs/architecture.md) | Modules, rendering and caching, security model |
| [database-schema.md](docs/database-schema.md) | Tables and the rules they enforce |
| [ecommerce-workflows.md](docs/ecommerce-workflows.md) | Cart, checkout, payment, stock, order lifecycle, refunds |
| [admin-guide.md](docs/admin-guide.md) | Day-to-day use of the admin panel, and account recovery |
| [bulk-orders.md](docs/bulk-orders.md) | Bulk enquiry workflow |
| [seo-strategy.md](docs/seo-strategy.md) | Technical SEO, content plan, local SEO, AI search readiness |
| [environment-variables.md](docs/environment-variables.md) | Every setting, with production rules |
| [deployment.md](docs/deployment.md) | Vercel, database, storage, Razorpay, email, domain |
| [testing.md](docs/testing.md) | Test suites and how to run them |
| [launch-checklist.md](docs/launch-checklist.md) | What must be done before taking real orders |
