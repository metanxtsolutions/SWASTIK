# Deployment (Vercel)

Nothing has been deployed from this repository yet. These are the steps to do it.

## 1. Accounts you need

| Service | Purpose | Notes |
|---|---|---|
| Vercel | Hosting | Region `bom1` (Mumbai) is set in `vercel.json` |
| PostgreSQL | Data | Neon, Supabase or any managed Postgres, ideally in Mumbai. Create a separate database (or Neon branch) for Preview deployments |
| Cloudflare R2 or AWS S3 | Product photos | Or use `STORAGE_DRIVER=database` for a small catalogue |
| Razorpay | Online payments | Business KYC must be approved for live mode |
| SMTP email provider | Order and enquiry emails, password resets | Verify your sending domain (SPF, DKIM) |
| Domain | For example `swastikflowers.in` | |

## 2. Create the Vercel project

1. Import the GitHub repository in Vercel. Framework: Next.js. Build command: `npm run vercel-build` (runs migrations, base content, optional sample data, then `next build`). Install command: `npm install`.
2. Set the environment variables from [environment-variables.md](environment-variables.md):
   - **Production:** `APP_STAGE=production`, `APP_URL=https://<your domain>`, `DATABASE_URL` (pooled), `AUTH_SECRET`, `CRON_SECRET`, `EMAIL_*`/`SMTP_*`, `STORAGE_*`, `PAYMENT_GATEWAY=razorpay`, `RAZORPAY_*`.
   - **Preview:** `APP_STAGE=preview`, a separate `DATABASE_URL`, `PAYMENT_GATEWAY=mock`, `STORAGE_DRIVER=database`, `SEED_SAMPLE_DATA=true` if you want the sample catalogue, and its own `AUTH_SECRET`. Set `APP_URL` to the preview's address (or your preview domain).
3. Deploy. The build fails clearly if the database is unreachable, because pages are prerendered from it.

## 3. After the first production deploy

1. **Create the administrator:** run `npm run admin:create` locally with `DATABASE_URL` pointing at the production database, or set `ADMIN_SETUP_TOKEN`, open `https://<domain>/admin/setup`, create the account, then remove the variable and redeploy.
2. Sign in and work through the "To finish setting up" list on the Overview page and [launch-checklist.md](launch-checklist.md).

## 4. Razorpay

1. In the Razorpay dashboard create API keys (start with **Test mode** keys `rzp_test_...`).
2. Add a webhook: URL `https://<domain>/api/payments/webhook/razorpay`, a secret of your choice (put it in `RAZORPAY_WEBHOOK_SECRET`), events `payment.captured`, `payment.failed`, `refund.processed`, `refund.failed` (optionally `order.paid`).
3. With test keys, place test orders on the production site with Razorpay's test cards and UPI ids, try a failed payment, a refund, and closing the payment window. Check the order pages and Admin > Orders.
4. Switch to live keys only after these tests, by changing `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (and the live-mode webhook secret) and redeploying. The admin panel shows "Razorpay test mode" or "Razorpay live".

The Razorpay integration follows Razorpay's documented Orders API, Standard Checkout signature and webhook signature schemes. It has been tested in this repository against simulated responses only; the test-mode run above is the first real verification.

## 5. Images

For Cloudflare R2: create a bucket, an API token with Object Read and Write on that bucket, and set `STORAGE_DRIVER=s3`, `STORAGE_ENDPOINT`, `STORAGE_REGION=auto`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`. The bucket stays private; images are served and cached through `/api/media/...` and optimised by Next.js.

## 6. Email

Set `EMAIL_DRIVER=smtp` and the SMTP values, then use Admin > Forgot password (or place a test order with your email) and check Settings > Notifications for "sent".

## 7. Domain

Add the domain in Vercel, set the DNS records it shows, wait for the certificate, then set `APP_URL` to `https://<domain>` and redeploy. Redirect `www` to the main domain (or the other way round) in Vercel's domain settings.

## 8. Cron

`vercel.json` schedules `/api/cron/maintenance` daily at 00:23 UTC (05:53 IST). It cancels expired unpaid orders, and prunes rate-limit counters and old sessions. Vercel sends `CRON_SECRET` automatically. Expired orders are also released whenever a new order is placed or Admin > Orders is opened, so a daily schedule (the Vercel Hobby limit) is enough.

## 9. Post-deployment checks

- `https://<domain>/robots.txt` allows crawling and lists the sitemap; `/sitemap.xml` lists real pages only.
- A preview deployment shows the blue "Preview site" banner and `robots.txt` disallows everything.
- Admin pages redirect to sign-in when signed out.
- A test order goes through checkout, payment, confirmation, status updates and the customer's order page.
- A bulk enquiry appears in Admin > Bulk enquiries.
- Submit the sitemap in Google Search Console and verify the domain.

## Rollback

Use Vercel's "Promote" on a previous deployment. Migrations are forward-only: if a release added a migration, check the previous code still works with the new schema before rolling back (additive changes do).

## Backups

Use the database provider's automated backups and point-in-time recovery (Neon and Supabase both offer it). Test a restore into a separate database before launch. Images in R2 or S3 should have versioning or a periodic copy.
