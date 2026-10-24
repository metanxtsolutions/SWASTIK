# Architecture

## Overview

```
Browser ──> Next.js on Vercel (App Router)
              ├─ Storefront pages (server components, ISR)       src/app/(shop)
              ├─ Admin panel (dynamic, session checked per call) src/app/admin
              ├─ JSON API routes (cart quote, checkout, payments, src/app/api
              │   webhooks, bulk enquiry, contact, tracking, media, cron)
              └─ Server modules                                   src/server
                    ├─ services/   business rules (pure functions over a DB handle)
                    ├─ payments/   Razorpay and test gateway behind one interface
                    ├─ db/         Drizzle schema and pooled client
                    ├─ storage.ts  images: local disk, PostgreSQL or S3-compatible
                    └─ notify.ts   email (SMTP) with a delivery log
            PostgreSQL (Neon, Supabase or any managed Postgres)
            Optional: S3-compatible bucket (Cloudflare R2), SMTP provider, Razorpay
```

No background worker or queue is needed. Work that must happen later is either done on the next request (expired unpaid orders are released whenever a new order is placed or the admin opens orders) or by the daily Vercel Cron call to `/api/cron/maintenance`.

## Folders

| Path | Purpose |
|---|---|
| `src/app/(shop)` | Storefront routes and layout (header, footer, phone navigation) |
| `src/app/admin` | `(auth)` login, setup and password reset; `(panel)` everything behind the session; `_actions` server actions |
| `src/app/api` | Route handlers for the browser and for Razorpay |
| `src/components/shop`, `src/components/admin` | UI components |
| `src/lib` | Code shared by browser and server: money, units, dates (IST), phone numbers, cart store, illustrations |
| `src/server/services` | Catalogue, pricing, delivery, orders, payments, bulk enquiries, content, settings, admin auth, admin management |
| `scripts` | Migrations, seeds, administrator CLI |
| `drizzle` | SQL migrations |
| `tests`, `e2e` | Vitest service tests, Playwright end-to-end tests |

## Rendering and caching

- Public catalogue and content pages use incremental static regeneration (`revalidate = 300`). Product, category, collection and guide pages are rendered on first request and then cached.
- Every admin change calls `revalidatePath("/", "layout")`, so the storefront updates immediately. Orders and payments also refresh cached pages, since stock changed.
- Cart, checkout, order, tracking, search and admin pages are dynamic and marked `noindex`.
- The production build prerenders pages from the database, so the build needs a migrated database. On Vercel the `vercel-build` script runs migrations and seeding before `next build`.

## Security model

| Concern | Control |
|---|---|
| Admin authentication | One administrator row (enforced by a unique, always-true column). scrypt password hashes with per-hash parameters. 32-byte random session tokens stored as HMAC-SHA256 hashes. `HttpOnly`, `SameSite=Lax`, `Secure` cookie with the `__Host-` prefix on HTTPS. Seven-day lifetime, 48-hour idle timeout, password change ends other sessions. |
| Admin authorisation | Middleware redirects requests without a cookie; every admin page calls `requireAdmin()` and every server action runs through `adminAction()`, which checks the session in the database again. |
| Brute force | Postgres-backed sliding-window rate limits: sign-in (10 per IP and 5 per email per 15 minutes), password reset, checkout, quotes, PIN checks, tracking, bulk enquiries and contact. |
| CSRF | Server actions check the Origin header (Next.js). JSON POST endpoints require a same-origin `Origin`. Cookies are `SameSite=Lax`. Webhooks use signatures instead. |
| Price manipulation | The browser sends only variant ids and quantities. Totals are recalculated in a transaction with the variant rows locked, and the order is refused if the total differs from what the customer saw. |
| Duplicate orders | Each checkout carries an idempotency key (unique in the database); retries return the existing order. |
| Payment integrity | Orders become paid only after a verified checkout signature or a signed webhook. Webhook events are stored by id and processed once. Captures that do not match the total, or arrive after expiry, are flagged for refund. The test gateway is refused when `APP_STAGE=production`. |
| Order privacy | Random order numbers; order pages need a token derived from the order id with `AUTH_SECRET`; tracking needs the order number and the phone number and shows no address or payment data. |
| Uploads | File type detected from the bytes (JPEG, PNG, WebP only; SVG refused), size and dimension limits, served with `nosniff`. |
| Output | React escapes text; owner Markdown is rendered without HTML; JSON-LD escapes `<`; CSV exports neutralise spreadsheet formulas. |
| Headers | CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, strict referrer policy, restrictive permissions policy; `X-Robots-Tag: noindex` on private routes. |
| Secrets | Server-only environment variables validated at start-up; unsafe production values (development secrets, local storage, the test gateway, missing Razorpay keys) stop the app. |
| Audit | Sign-ins, failed sign-ins, password changes, and changes to orders, products, stock, prices, delivery, coupons, content and settings are written to `audit_logs`. |

## Time and money

- Dates for delivery are Indian Standard Time calendar dates (`src/lib/dates.ts`), so cut-offs behave the same on Vercel's UTC servers.
- Money is stored and calculated as integer paise. Order totals are checked by a database constraint (`total = subtotal - discount + delivery`).
