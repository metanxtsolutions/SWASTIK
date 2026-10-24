# Environment variables

All variables are server-only (none use `NEXT_PUBLIC_`). They are validated in `src/server/env.ts`. With `APP_STAGE=production` the app refuses to run if a value is unsafe. Business details (phone, WhatsApp, address, delivery areas, Cash on Delivery) are **not** environment variables: the owner sets them in the admin panel.

## Core

| Variable | Required in production | Description |
|---|---|---|
| `APP_STAGE` | Yes (`production`) | `development`, `preview` or `production`. Preview means test payments only, a visible banner, and `noindex` everywhere. Set `preview` for Vercel Preview deployments |
| `APP_URL` | Yes, `https://` | Public address, for example `https://swastikflowers.in`. Used for links in emails, canonical URLs and the sitemap |
| `DATABASE_URL` | Yes | PostgreSQL connection string. On Vercel use the provider's **pooled** connection string |
| `DATABASE_POOL_MAX` | No (default 5) | Connections per serverless instance |
| `AUTH_SECRET` | Yes, 32+ characters | Keys the hashes of admin sessions and reset tokens, and the customer order-link tokens. Generate with `openssl rand -base64 48`. Rotating it signs everyone out and changes order links |
| `CRON_SECRET` | Yes, 32+ characters | Vercel Cron sends it as `Authorization: Bearer ...` to `/api/cron/maintenance` |
| `ADMIN_SETUP_TOKEN` | No | Enables the one-time `/admin/setup` page while no administrator exists. 24+ characters. Remove after setup |

## Email

| Variable | Description |
|---|---|
| `EMAIL_DRIVER` | `outbox` (nothing sent; recorded and shown as not sent) or `smtp` |
| `EMAIL_FROM` | Sender, for example `Swastik <orders@yourdomain.in>`. Use a domain verified with your provider (SPF and DKIM) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | From the provider (Zoho Mail, Amazon SES, Brevo, Postmark, Resend and others offer SMTP) |
| `SMTP_TLS` | `starttls` (587), `implicit` (465); `none` is refused in production |

## Image storage

| Variable | Description |
|---|---|
| `STORAGE_DRIVER` | `s3` (recommended), `database` (simple; images in PostgreSQL) or `local` (development only; refused in production because Vercel has no persistent disk) |
| `STORAGE_ENDPOINT` | For Cloudflare R2: `https://<account-id>.r2.cloudflarestorage.com`. Empty for AWS S3 |
| `STORAGE_REGION` | `auto` for R2, or the AWS region (for example `ap-south-1`) |
| `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` | Bucket name and an access key limited to that bucket. The bucket does not need to be public: images are served through `/api/media/...` |
| `STORAGE_LOCAL_DIR` | Folder for `local` (default `./storage`) |

## Payments

| Variable | Description |
|---|---|
| `PAYMENT_GATEWAY` | `razorpay`, `none` (no online payment) or `mock` (test gateway; refused in production) |
| `RAZORPAY_KEY_ID` | Key id from the Razorpay dashboard. `rzp_test_...` for test mode, `rzp_live_...` for live. The id is sent to the browser for Checkout; it is not a secret |
| `RAZORPAY_KEY_SECRET` | Key secret (server only) |
| `RAZORPAY_WEBHOOK_SECRET` | The secret you choose when creating the webhook in Razorpay |
| `MOCK_WEBHOOK_SECRET` | Signs test-gateway webhooks in development and preview |

Online payment also has to be enabled in Admin > Settings > Checkout and payments. Cash on Delivery is a separate admin switch, off by default.

## Sample data

| Variable | Description |
|---|---|
| `SEED_SAMPLE_DATA` | `true` adds the illustrative sample catalogue during `npm run db:seed:sample` (and during Vercel builds through `--if-enabled`). Refused when `APP_STAGE=production` |

## Administrator CLI (only when running the scripts)

`ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` let `npm run admin:create` and `npm run admin:reset-password` run without prompts. Do not store them in Vercel.

## Not yet integrated (future)

- **WhatsApp Business messages:** automatic order updates need a WhatsApp Business Platform provider (Meta Cloud API or a BSP such as Gupshup or Interakt), approved message templates and customer opt-in. Consent is already collected at checkout (`whatsapp_consent`). The notification module (`src/server/notify.ts`) is where a provider would be added.
- **SMS:** needs an Indian SMS provider with DLT-registered templates.
- **Analytics:** none installed. If added, update the privacy policy and the CSP in `next.config.ts`.
