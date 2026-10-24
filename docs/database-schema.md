# Database schema

PostgreSQL, defined in `src/server/db/schema.ts` and created by the SQL migrations in `drizzle/`. Column names are snake_case. Money is integer paise. Times are `timestamptz`; delivery dates are plain `date` values in Indian Standard Time.

## Administrator and security

| Table | Purpose and rules |
|---|---|
| `admin_users` | The master administrator. A `singleton` column that must be true, with a unique index, means the table can hold only one row. Stores the scrypt hash, never the password. |
| `admin_sessions` | One row per sign-in: HMAC hash of the session token, IP, user agent, expiry, last activity, revocation time. |
| `password_reset_tokens` | Hashed one-time reset tokens with a 30-minute expiry. |
| `rate_limits` | Sliding-window counters keyed by action and hashed IP or email. Pruned daily. |
| `audit_logs` | Who did what, to which record, with small JSON details. No passwords or tokens. |

## Settings and media

| Table | Purpose |
|---|---|
| `settings` | Key-value JSON for `business`, `checkout`, `homepage`, `seo` and `notifications`. Each key is validated by a Zod schema with safe defaults (`src/server/services/settings.ts`). |
| `media` | Uploaded images: storage key (derived from the SHA-256 of the file), type, size, dimensions, alt text. |
| `stored_objects` | Image bytes when `STORAGE_DRIVER=database`. |

## Catalogue

| Table | Purpose and rules |
|---|---|
| `categories` | Name, unique slug, summary, introduction, image, order, visibility, SEO fields. Deleting a category with products is refused. |
| `collections` | Festival and occasion groupings with optional date window. |
| `products` | Name, unique slug, category, descriptions, usage and care text, main unit, tags, status (draft, published, archived), featured and bestseller flags, SEO fields. |
| `product_variants` | The sellable options: label, unique SKU, unit, price, optional sale price, stock tracking, stock, minimum and maximum per order, active flag. Checks: price above zero, sale price below price, stock never negative, sensible minimum and maximum. |
| `product_images` | Ordered photos per product with alt text; the lowest order is the main photo. |
| `product_collections` | Many-to-many link to collections. |
| `product_zones` | Optional: when present, the product is sold only in those delivery zones. |
| `stock_movements` | Every stock change with reason (order placed, order released, admin adjustment) and order link. |

## Delivery

| Table | Purpose and rules |
|---|---|
| `delivery_zones` | Area name, active flag, fee, minimum order, free-delivery threshold, lead days, how far ahead customers can book, same-day switch and cut-off, customer note, optional landing page content. |
| `zone_pincodes` | PIN code (primary key, so one zone per PIN, format checked) to zone, with localities. |
| `delivery_slots` | Per zone: label, start and end time, booking cut-off in minutes, optional capacity per day, days of the week, active flag. |
| `delivery_blackouts` | Closed dates for one zone or for all zones. |

## Orders and payments

| Table | Purpose and rules |
|---|---|
| `orders` | Random order number (unique), unique idempotency key, status and payment status, method, customer and address snapshot, zone and slot snapshots, delivery date, totals (checked: total = subtotal - discount + delivery fee), refunded amount, coupon, cancellation reason, WhatsApp consent, source (web, bulk enquiry, admin), payment deadline. |
| `order_items` | Snapshot of product name, option label, SKU, unit text, unit price, quantity and line total, so later catalogue changes never rewrite old orders. `stock_reserved` records whether stock must be returned on cancellation. |
| `order_events` | Status changes, payment events, refunds and notes. Internal notes are hidden from customers. |
| `payments` | One row per gateway order or recorded payment: provider, provider order and payment ids (unique), amount, status, method, failure reason, test flag. |
| `refunds` | Gateway or recorded refunds with status and reason. |
| `webhook_events` | Every verified webhook by provider event id (primary key), so redelivered events are processed once. |
| `coupons`, `coupon_redemptions` | Promo codes with type, value, minimum order, maximum discount, dates, total and per-phone limits; one redemption row per order. |

## Bulk enquiries, content and messages

| Table | Purpose |
|---|---|
| `bulk_enquiries` | Reference, institution, contact, phone, email, address, PIN, date, preferred time, frequency, recurring details, instructions, status, quoted amount, next follow-up, converted order. |
| `bulk_enquiry_items` | One row per flower variety: name, quantity (decimal), unit, notes. |
| `bulk_enquiry_notes` | Notes, quotation details, follow-ups and status changes. |
| `banners` | Hero and offer banners with optional image and date window. |
| `faqs` | Question, answer, topic, optional category, order, published flag. |
| `pages` | Owner pages served at `/<slug>` (about, policies). |
| `articles` | Guides at `/guides/<slug>`, with draft or published status. |
| `testimonials` | Genuine customer reviews added by the owner, hidden until published. |
| `redirects` | Old path to new path, permanent or temporary, with a visit counter. |
| `contact_messages` | Messages from the contact form. |
| `notifications` | Email log: template, recipient, subject, status (sent, stored, failed, not configured), error. Password reset bodies are not stored outside development. |

## Migrations

```bash
npm run db:generate   # after editing schema.ts: writes a new SQL migration in drizzle/
npm run db:migrate    # applies pending migrations (also run by vercel-build)
```

Review generated SQL before committing it. Never edit a migration that has already run in production; add a new one.
