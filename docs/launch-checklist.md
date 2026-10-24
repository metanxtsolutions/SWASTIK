# Launch checklist

Tick everything before taking real orders. Items marked **(blocker)** stop the site from working correctly.

## Accounts and credentials (owner)

- [ ] **(blocker)** Production PostgreSQL database created; pooled `DATABASE_URL` set in Vercel.
- [ ] **(blocker)** `APP_STAGE=production`, `APP_URL` (https), `AUTH_SECRET`, `CRON_SECRET` set.
- [ ] **(blocker)** Image storage configured (`STORAGE_DRIVER=s3` with R2/S3, or `database`).
- [ ] **(blocker for online payment)** Razorpay account approved; test keys tested end to end; live keys and webhook secret set; webhook created.
- [ ] SMTP email configured and a test email received. Without it, no customer or owner emails are sent and password reset needs the command line.
- [ ] Domain connected with HTTPS.

## Admin set-up (owner)

- [ ] **(blocker)** Administrator account created; `ADMIN_SETUP_TOKEN` removed if it was used.
- [ ] Business name, phone, WhatsApp number, public email and alert email entered and checked.
- [ ] Address entered; "details are correct" ticked only when it matches the Google Business Profile.
- [ ] **(blocker)** At least one delivery area active with the right PIN codes, charge, minimum order, lead time, slots and cut-offs.
- [ ] Holidays added as closed dates.
- [ ] **(blocker)** Payment method available: online payment working, and/or Cash on Delivery deliberately enabled.
- [ ] Payment window, maximum quantity per item and low-stock threshold reviewed.

## Catalogue and content (owner)

- [ ] **(blocker)** Real products added with honest descriptions, correct units, prices and stock, and published.
- [ ] Real photos uploaded for every product (the illustrations are placeholders), with descriptions.
- [ ] Category summaries and introductions reviewed; empty categories hidden or filled.
- [ ] Festival collections given dates and products, or hidden.
- [ ] Home page texts and the "Why order from us" points checked for accuracy.
- [ ] Policy pages completed (every `[[confirm: ...]]` replaced), reviewed by a lawyer, and published: privacy policy, terms, cancellation and refund policy, delivery policy, about us.
- [ ] FAQs checked against how the business actually works.
- [ ] Starter guides read, corrected where needed, and published.
- [ ] No sample products or sample delivery settings in the production database (the sample seed refuses to run in production; check anyway).

## Verification (owner and developer)

- [ ] Place a real low-value order with live payment, then refund it.
- [ ] Place a Cash on Delivery order (if enabled), confirm it, record payment, mark delivered.
- [ ] Let an online order expire unpaid and check the stock comes back.
- [ ] Submit a bulk enquiry and convert it to an order.
- [ ] Try a PIN code outside the delivery area.
- [ ] Check the site on a small Android phone, an iPhone, a tablet and a desktop.
- [ ] Sign out and confirm `/admin` pages and `/admin/orders/export` are not reachable.
- [ ] Run Lighthouse on the live home, category and product pages.
- [ ] Google Search Console: domain verified, sitemap submitted.
- [ ] Google Business Profile created or claimed, with the website link.
- [ ] Database backups enabled and a restore tested.

## Known limitations at launch

- Reference websites (phool.co, fnp.com) could not be opened from the build environment; the design follows the brief instead.
- WhatsApp and SMS notifications are not automated (one-tap links are provided).
- Razorpay has been tested only against simulated responses in this repository; the test-mode run in [deployment.md](deployment.md) is required.
- English only; Bengali and Hindi need translation work (see [business-requirements.md](business-requirements.md)).
- No automatic recurring orders for temples (handled through enquiries).
