# Business requirements and decisions

## The business

- **Name:** Swastik. **Category:** puja flowers and floral offerings.
- **Model:** direct-to-customer online shop plus a bulk enquiry and quotation service for mandirs and large buyers.
- **Starting area:** Rishra, Hooghly, West Bengal. More areas are added from the admin panel as operations grow.
- **Currency:** Indian Rupees. **Language:** English (see "Languages" below for Bengali and Hindi).

## What was built (in scope)

1. A complete storefront: discovery, product pages, cart, guest checkout, order confirmation and tracking.
2. No customer accounts, registration, vendor accounts or vendor dashboards.
3. One master administrator who manages products, prices, stock, orders, enquiries, delivery areas, content and settings.
4. A dedicated bulk order page and enquiry form that accepts several flower varieties.
5. Configurable delivery coverage: PIN codes per area, charges, minimum orders, free-delivery thresholds, slots, cut-offs, capacity and closed dates.
6. Payments through Razorpay, with Cash on Delivery available only when the owner switches it on.
7. Technical SEO and content structures that help search engines and AI assistants understand the business.

## Decisions taken without waiting for approval

| Decision | Why |
|---|---|
| Next.js 15.5 (the maintained 15.x line), Drizzle ORM and PostgreSQL | Same toolchain as the organisation's existing AutoSutra project, which builds and deploys on Vercel. Drizzle is lighter than Prisma in serverless functions. Upgrading to Next.js 16 is a follow-up task. |
| Every product has one or more **options** (variants), each with its own price, unit, SKU and stock | Flowers are sold by piece, bunch, garland, pack or weight. Options like 250 g / 500 g / 1 kg keep the price per unit explicit, and quantities stay whole numbers. |
| All new orders wait for the owner's confirmation (status "Pending confirmation"), including paid ones | Flowers are sourced daily, so the owner checks availability before committing. |
| Online orders reserve stock for a payment window (30 minutes by default) | Prevents overselling while a customer pays; unpaid orders are cancelled automatically and the stock released. |
| Order links carry a secret token; tracking needs order number plus phone | Order numbers are random, and no address, phone or payment detail is reachable from a guessable URL. |
| Bulk orders work as enquiry, quotation, then a confirmed order entered by the owner | Matches the requested workflow without customer accounts. |
| Starter content is honest by construction | Categories, FAQs about how the website works, policy drafts with `[[confirm: ...]]` markers that block publishing, and guides saved as **drafts** for the owner to review. No products, prices, offers, reviews, phone numbers or addresses were invented. |
| Original illustrations instead of stock photos | Shown only until the owner uploads real photos, and labelled as illustrations. |

## Assumptions to confirm with the business

- The first delivery area is created **inactive** with PIN code 712248 (Rishra). Confirm the PIN codes, localities, delivery charge, minimum order, slots and cut-offs, then activate it.
- Delivery fees, slot times, payment window and low-stock threshold are business choices: defaults are placeholders only.
- Same-day delivery is off. Turn it on per area only if it can be delivered reliably.
- Policy pages (privacy, terms, cancellation and refund, delivery) need the business's own details and a legal review.
- The guides describe widely known practices and say that traditions vary. The owner should read them before publishing.

## Reference websites

The brief asked for an analysis of phool.co (brand presentation) and fnp.com (e-commerce structure). **Neither site could be opened from the build environment**: the network policy refused both hosts. No claims are made about their pages. The design follows the brief's description of what to take from each (warm, premium floral presentation; clear category navigation, search, delivery PIN checks, product cards and a short checkout) and common e-commerce practice. To review them later, allow `phool.co` and `www.fnp.com` in the environment's network settings.

## Out of scope (by design)

Customer login, vendor portal, marketplace features, subscriptions with automatic billing, and automatic WhatsApp or SMS messages (the owner messages customers with one-tap WhatsApp links; see [environment-variables.md](environment-variables.md) for adding a provider later).

## Languages

The interface is in English. What is already in place for Bengali and Hindi: the `<html lang>` attribute, Bengali and Devanagari fonts in the font fallback stack, Unicode-safe text handling, and owner-managed content. What a second language still needs: moving interface text from the components into per-language message files, translated fields (or a translations table) for products, categories, pages and FAQs, and a locale segment such as `/bn/...` with `hreflang` alternates in the metadata and sitemap. This is a follow-up project.
