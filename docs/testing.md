# Testing

## Suites

| Command | What it runs |
|---|---|
| `npm run lint` | ESLint (Next.js core web vitals and TypeScript rules) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest service tests against a real PostgreSQL database (`swastik_test`, rebuilt from the migrations on every run; tables emptied before each test) |
| `npm run test:e2e` | Playwright: resets `swastik_e2e`, seeds base content, the sample catalogue and an administrator (`e2e/prepare.ts`), makes a **production build**, starts it on port 3200 and runs the browser tests on a Pixel 7 phone profile and a 1366 px desktop |
| `npm run check` | lint, typecheck, Vitest and the production build |

Set `TEST_DATABASE_URL` or `E2E_DATABASE_URL` to use other databases. If Playwright's own Chromium is not installed, set `PLAYWRIGHT_CHROMIUM_PATH`.

## Service tests (`tests/`)

| File | Covers |
|---|---|
| `pricing.test.ts` | Database prices, sale prices, duplicate lines merged, stock and minimum checks, unpublished products, delivery fee and free-delivery threshold, unserviceable PIN codes, minimum order, percentage, fixed and free-delivery coupons with limits and expiry, area-restricted products, per-line maximums |
| `checkout.test.ts` | COD off by default, order with snapshots and reserved stock, snapshot unchanged after a price edit, manipulated totals refused, browser price fields ignored, idempotent retries, two customers racing for the last stock, PIN, date, slot and cut-off validation, slot capacity, field errors, honeypot, paused ordering, coupon use and release on cancellation, expiry of unpaid orders releasing stock, allowed status changes, same-day cut-off |
| `payments.test.ts` | No paid state without a verified event, bad webhook signatures refused, duplicate webhooks processed once, gateway order reused on retry, failure then success, amount mismatch, capture after expiry flagged for refund, checkout signature verification, partial and full refunds with limits, paying a cancelled order refused, Razorpay signature and webhook parsing, amounts in paise |
| `admin-auth.test.ts` | Only one administrator, weak passwords refused, sign-in and sign-out, only token hashes stored, sign-in rate limit, idle and absolute session expiry, password change signs out other devices, one-time reset links |
| `bulk-and-tracking.test.ts` | Bulk enquiry with several varieties, validation, honeypot, too-fast submissions, past dates, quotation notes and conversion to an order, contact form, order access only with the secret token, tracking that reveals no address or phone, random order numbers |
| `delivery-and-lib.test.ts` | Serviceable, invalid and inactive areas, lead time, closed dates and weekday-only slots, same-day cut-off, PIN code list parsing, rupee formatting and parsing, Indian mobile numbers and WhatsApp links, unit wording, image type detection (SVG refused), CSV formula neutralisation |

## End-to-end tests (`e2e/`)

| File | Covers |
|---|---|
| `shop.spec.ts` | Home page and preview banner, search and empty results, PIN code checks, add to cart, guest checkout and test payment, failed payment with retry, 404 for order pages without a token and for missing products, minimum order blocking checkout, bulk enquiry with two varieties, admin pages needing sign-in, cross-site checkout refused, forged webhook refused, robots and sitemap, no sideways scrolling at 360, 768 and 1280 px on eleven pages |
| `admin.setup.ts`, `admin.spec.ts` | Sign-in keeps the email after a wrong password; bulk enquiry visible with its lines; order confirmed; CSV export; product price edit reflected in the shop; product photo upload (and a fake image refused); business details shown on the site; promo code created and applied in the cart; new delivery area with a time slot shown on the delivery page |

## Latest results

Run on 24 October 2026 (UTC) in the build environment (Node.js 22, PostgreSQL 16, Chromium 1243 headless):

| Check | Result |
|---|---|
| `npm run lint` | No errors or warnings |
| `npm run typecheck` | No errors |
| `npm test` | 6 files, **61 tests passed** |
| `npm run test:e2e` | **35 passed**, 3 skipped (the width checks run once, in the desktop project, by design) |
| Production build | Succeeds (run by the e2e suite) |

### Lighthouse

Lighthouse 12 against a local production build with `APP_STAGE=production` and the sample catalogue (no CDN, images served and optimised by the local server on first request, so Vercel should be similar or faster):

| Page | Mobile perf | Desktop perf | Accessibility | Best practices | SEO |
|---|---|---|---|---|---|
| Home | 96 | 99 | 99 | 100 | 100 |
| Shop | 99 | 100 | 98 | 100 | 100 |
| Category | 95 | 100 | 98 | 100 | 100 |
| Product | 87 | 100 | 100 | 100 | 100 |
| Bulk orders | 98 | 100 | 99 | 100 | 100 |

Mobile largest contentful paint was 2.1 to 3.7 s under Lighthouse's slow 4G and CPU throttling; desktop 0.6 to 0.8 s. Layout shift stayed at or below 0.026. The product page's mobile score is held back by the first, uncached optimisation of the main product image. The remaining accessibility findings (decorative category images with duplicate alt text, heading order on listings, the logo link label) were fixed after this run and have not been re-measured.

## Not covered by automated tests

- Real Razorpay test-mode or live payments (the adapter is tested with simulated responses only).
- Real SMTP delivery (tests use the outbox driver).
- S3 or R2 image storage (tests use PostgreSQL storage).
- Physical devices and iOS Safari: the end-to-end tests use Chromium with phone and desktop viewports.
- Load testing.
