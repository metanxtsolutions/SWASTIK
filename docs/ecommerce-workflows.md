# E-commerce workflows

## Cart

1. The cart lives in the browser's local storage (`src/lib/cart-store.ts`): only option ids, quantities, the PIN code and a promo code. It survives closing the tab on the same device and syncs between tabs.
2. Whenever the cart is shown, the browser asks `POST /api/cart/quote` for prices. The server loads the options from the database and returns names, photos, unit prices, line totals, stock problems, the delivery fee for the PIN code, the discount and the total.
3. Options that are no longer sold are removed from the stored cart automatically. Lines with problems (out of stock, below minimum, above available stock, not sold in that area) are shown with the reason and an easy fix.

## Checkout (`POST /api/checkout`)

The checkout form collects name, mobile number, optional email, address, PIN code, delivery date and slot, payment method, notes and optional WhatsApp consent. On submit the server:

1. Validates the input (Zod) and the honeypot field, and rate limits by IP.
2. Returns the existing order if the idempotency key has been seen (safe retries after a dropped connection).
3. Checks that ordering is open and that the chosen payment method is enabled.
4. Releases stock held by expired unpaid orders.
5. In one transaction: locks the option rows, re-prices the cart, checks stock, area restrictions, the promo code (row locked) and the minimum order, validates the date and slot (slot row locked to enforce capacity), and compares the total with the total the customer saw. Any difference stops the order with a clear message.
6. Creates the order and item snapshots, reserves stock, records stock movements and the coupon use, and logs the first order event.
7. After the response: sends the notifications and refreshes cached pages.

## Payments

**Online (Razorpay):**

1. The browser calls `POST /api/payments/start`; the server creates a Razorpay order for the exact total (or reuses the open one) and returns the public key id and order id.
2. Razorpay Checkout collects the payment. Its success handler posts the payment id and signature to `/api/payments/razorpay/verify`, which checks `HMAC_SHA256(order_id|payment_id, key_secret)`.
3. Razorpay also sends a signed webhook to `/api/payments/webhook/razorpay`. Either path marks the order paid exactly once.
4. The order page polls the server until the payment is confirmed. It never shows "paid" from the browser's word alone.
5. Failed attempts are recorded; the customer can retry until the payment window closes (30 minutes by default). Then the order is cancelled and its stock released.
6. A payment that arrives after the order expired, or for the wrong amount, is recorded and the order is marked "Refund pending" for the owner.

**Test mode:** with `PAYMENT_GATEWAY=mock` (development and preview only) the customer is taken to `/pay/test/...`, where buttons send a signed test webhook through the same verification and processing code.

**Cash on Delivery:** available only when the owner enables it (optionally with a maximum order value). The order starts as "Pending confirmation, not paid"; the owner records the payment when collected.

## Order lifecycle

| Status | Meaning | Next |
|---|---|---|
| Pending payment | Online order waiting for payment | Paid: Pending confirmation. Not paid in time: Cancelled |
| Pending confirmation | Placed (and paid, if online); the shop has to confirm | Confirmed, Cancelled |
| Confirmed | The shop accepted it | Preparing, Ready for dispatch, Out for delivery, Delivered, Cancelled |
| Preparing | Being made up | Ready for dispatch, Out for delivery, Delivered, Cancelled |
| Ready for dispatch | Packed | Out for delivery, Delivered, Cancelled |
| Out for delivery | With the delivery person | Delivered, Cancelled |
| Delivered | Done | (refunds still possible) |
| Cancelled | With a reason; reserved stock and coupon use are returned | |

Payment status is tracked separately: Not paid, Payment pending, Paid, Payment failed, Refund pending, Partially refunded, Refunded. Refund states are payment states rather than order statuses, so an order can be "Delivered, Partially refunded".

## Refunds

From the order page the owner enters an amount and reason. Online payments are refunded through the gateway (Razorpay refund API; webhook updates confirm completion). Cash or other offline payments are recorded as refunded by the owner. The total refunded can never exceed what was received.

## Delivery rules

- A PIN code is serviceable only if it belongs to an **active** zone.
- Earliest date = today + lead days. With lead days 0, same-day is offered only if the zone allows it and the current IST time is before the zone's cut-off.
- Dates beyond "book up to" days ahead, closed dates, and days without an open slot are not offered.
- A slot closes its configured number of minutes before it starts, and closes when its daily capacity is reached.
- The fee is waived when the items total after discount reaches the zone's free-delivery threshold.

## Customer access to orders

- Confirmation link: `/order/<number>?t=<token>`. The token is derived from the order id with `AUTH_SECRET` and cannot be guessed from the number. The page shows the full order to whoever holds the link.
- Track Order: order number plus the checkout phone number. Shows status, dates, items and updates, but no address, phone or payment details. Rate limited.

## Notifications

| Event | Customer (if email given) | Owner (alert address) |
|---|---|---|
| COD order placed | Order received | New order |
| Online payment captured | Payment received | New order |
| Payment failed | Payment not completed | |
| Status changed to Confirmed, Out for delivery, Delivered (when the owner ticks "email the customer") | Update | |
| Cancelled | Cancellation with reason | |
| Refund | Refund update | |
| Bulk enquiry | Enquiry received | New enquiry |

Emails are sent only when SMTP is configured; otherwise they are logged as "not sent" and the admin panel says so. WhatsApp and SMS are not sent automatically; orders and enquiries have one-tap WhatsApp and call buttons for the owner.
