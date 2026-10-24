# Admin guide

The admin panel is at **/admin**. There is one master administrator account. Customers never sign in.

## First-time setup

1. **Create the administrator** (once):
   - From a computer with access to the database: `npm run admin:create` and answer the prompts. For automation set `ADMIN_EMAIL`, `ADMIN_NAME` and `ADMIN_PASSWORD` instead (the password is never printed).
   - Or on Vercel: set `ADMIN_SETUP_TOKEN` to a long random value, open `/admin/setup`, enter the token and your details, then **remove `ADMIN_SETUP_TOKEN`** and redeploy. The page stops working as soon as an administrator exists.
2. Sign in at `/admin/login`. The Overview page lists what is still missing ("To finish setting up").
3. **Settings > Business:** name, phone, WhatsApp number, email, alert email, address, hours, social links. Tick "details are correct" only when the address and phone match your Google Business Profile.
4. **Delivery areas:** open Rishra, check the PIN codes and localities, set the delivery charge, minimum order, free-delivery amount, lead time and booking window, add time slots, then tick **Active**.
5. **Settings > Checkout and payments:** confirm online payment is configured; turn on Cash on Delivery only if you want it.
6. **Products:** add products (see below) and publish them.
7. **Website content > Pages:** replace every `[[confirm: ...]]` note in the policy drafts, then publish them. **Guides:** read the starter guides, adjust, publish.

## Daily work

### Orders

- **Overview** shows orders waiting for confirmation, open orders, low stock and sales.
- **Orders** can be filtered by status, payment, order date or delivery date, and searched by order number, name, phone or PIN. **Export CSV** downloads the filtered list.
- On an order:
  - **Update status:** move it along (Confirmed, Preparing, Ready for dispatch, Out for delivery, Delivered). Add a message for the customer and tick "Email the customer" to send an update.
  - **Cancel:** give a reason. Reserved stock and the promo code use are returned. Paid orders move to "Refund pending".
  - **Record payment:** for Cash on Delivery, mark the money as received (cash, UPI to the shop or bank transfer).
  - **Refund:** online payments go back through the payment gateway; offline payments are recorded as paid back.
  - **Call / WhatsApp / Email:** open your phone's dialler, WhatsApp chat or email with the customer. The WhatsApp button notes whether the customer agreed to WhatsApp contact.
  - **Internal notes** are visible only in the admin panel.
- Unpaid online orders are cancelled automatically after the payment window.

### Bulk enquiries

See [bulk-orders.md](bulk-orders.md).

### Products and stock

- **Add product:** name, category, short description, description (at least 30 characters to publish), uses and care notes, search tags.
- **Options:** each option has a label (for example 250 g, 500 g, 3 ft), what one unit is (per pack, per bunch, per piece, per garland, per kg...), price, optional sale price, SKU, stock, and minimum and maximum per order. The form shows exactly what customers will see, for example "₹40 per 250 g pack". Untick "Track stock" for made-to-order items.
- **Photos:** upload after saving. JPEG, PNG or WebP, at least 400 × 400 pixels, up to 5 MB. Describe each photo. The first photo is the main one.
- **Status:** Draft (hidden), Published (on sale), Archived (hidden, kept for history). Products that have been ordered are archived instead of deleted.
- **Stock:** quick stock updates for every option, low-stock filter and recent changes.
- **Featured** products appear in "Popular puja flowers" unless you choose specific products on the home page editor.

### Categories and collections

- Categories organise the shop and appear in the menu once they have published products. Reorder with the arrows; hide instead of deleting.
- Collections group products for festivals. Give them dates to show them only around the festival. Assign products from each product's page.

### Delivery areas

Add an area for each new locality you serve: PIN codes (one per line, `712248, Rishra`), charges, slots and closed dates. A PIN code can belong to one area only. Close dates for holidays under "Dates closed in every area". Optionally publish an area landing page with at least 300 characters of genuinely useful local information.

### Promo codes

Percentage, fixed amount or free delivery, with minimum order, maximum discount, start and end, total uses and uses per customer (by phone number). Codes are checked again when the order is placed.

### Website content

Home page sections and texts, hero and offer banners, FAQs, pages and policies, guides, genuine customer reviews (published only with the customer's permission), and redirects for renamed pages.

### Settings

Business details, checkout and payments, notification preferences with an email log, and search engine defaults (titles, description, sharing image, Google Search Console verification).

## Security and account recovery

- **Change password:** Account > Change password. Other devices are signed out.
- **Sign out other devices:** Account > Sign out all other devices.
- **Forgot password:** `/admin/forgot-password` sends a 30-minute reset link to the administrator email, if SMTP email is configured.
- **Without email,** on a machine with database access: `npm run admin:reset-password` (prompts for the email and new password; every session is signed out). `npm run admin:revoke-sessions` signs out everything.
- **Rotating credentials:** change the password regularly and after staff changes. To invalidate every session and every customer order link at once, rotate `AUTH_SECRET` in Vercel and redeploy; note that this also changes order confirmation links already emailed to customers (they can still use Track Order).
- Sign-in is limited to 10 attempts per IP and 5 per email in 15 minutes. All sign-ins and important changes are listed in **Activity log**.
