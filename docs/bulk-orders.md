# Bulk orders for mandirs and large buyers

## The customer side (`/bulk-orders`)

The page explains the service for mandirs, puja committees, pandits, festival and event organisers, and anyone with large or regular needs:

- How bulk ordering works, in four steps.
- Flowers they can ask for (the shop's categories, plus anything else).
- Regular requirements (daily, weekly, monthly, festival season).
- Delivery locations (the active delivery areas, and an invitation to enquire from elsewhere).
- Bulk order FAQs (topic "Bulk orders" in the FAQ editor).
- Call and WhatsApp buttons when those numbers are set in Settings. No number is ever invented.

The page says clearly that an enquiry is not a confirmed order, and makes no promises about volumes, prices or coverage.

### The enquiry form

Collects the institution or customer name, contact person, mobile number, optional email, delivery address, PIN code, required date, optional preferred time, one-time or regular requirement with schedule details, instructions, and **any number of flower lines** (variety, quantity, unit, notes). Variety names can be typed freely, with suggestions.

Protection against spam: a hidden honeypot field, a minimum fill time of three seconds, server-side validation and a limit of six enquiries per hour per connection. The success message, with the enquiry reference (for example `BQ-7KD4Q9`), appears only after the server has stored the enquiry.

## The owner side (Admin > Bulk enquiries)

1. **New enquiries** are counted on the Overview and in the menu badge, and emailed to the alert address if email is configured.
2. Open an enquiry to see the flower lines, date, schedule, address and contact details, with Call and WhatsApp buttons.
3. Record progress: status (New, Contacted, Quotation sent, Accepted, Converted to order, Declined, Closed), the quotation amount, the next follow-up date, and notes typed as Note, Quotation details or Follow-up.
4. When the customer accepts, use **Create an order from this enquiry**. The form is pre-filled with the enquiry's lines and address; enter the agreed price per unit for each line, any delivery charge, and whether payment has already been received. This creates a **Confirmed** order (source "From bulk enquiry") that appears in Orders, and marks the enquiry as converted.
5. From then on the order follows the normal workflow: status updates, recording payment, notes and refunds.

Quantities on a confirmed order are whole numbers; express fractions in a smaller unit (2.5 kg as 5 × 500 g).

## Recurring supply

The first version handles regular customers through the enquiry and follow-up notes, and one confirmed order per delivery. Automatic recurring orders or subscriptions are not built; if regular temple supply grows, a "repeat order" or standing-order feature can be added on the same tables.
