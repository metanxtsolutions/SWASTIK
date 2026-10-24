/**
 * Starting content for a new Swastik site. Everything here is either true by
 * construction (how the website works) or general, widely known information
 * about puja flowers, written to be reviewed by the owner. Guides and policy
 * pages are created as unpublished drafts. Policy drafts contain [[confirm: ...]]
 * markers that must be replaced before the admin panel allows publishing.
 */

export const CATEGORIES = [
  { name: "Marigold Flowers", slug: "marigold-flowers", summary: "Loose marigold (genda) flowers and marigold strings for puja, decoration and garland making." },
  { name: "Rose Flowers", slug: "rose-flowers", summary: "Roses and rose petals for offerings, garlands and decoration." },
  { name: "Jasmine and Mogra", slug: "jasmine-and-mogra", summary: "Fragrant white flowers such as jasmine, mogra and bela, loose or strung." },
  { name: "Hibiscus", slug: "hibiscus-flowers", summary: "Red hibiscus (jaba) flowers, widely offered in worship in Bengal." },
  { name: "Lotus", slug: "lotus-flowers", summary: "Lotus flowers for special pujas and festival offerings." },
  { name: "Bel Patra and Puja Leaves", slug: "bel-patra-and-puja-leaves", summary: "Bel (bilva) leaves, tulsi, durva and other leaves used in puja." },
  { name: "Flower Garlands", slug: "flower-garlands", summary: "Ready-made garlands (mala) in different flowers and lengths." },
  { name: "Mixed Flower Bundles", slug: "mixed-flower-bundles", summary: "Assorted flowers bundled together for convenience." },
  { name: "Daily Puja Flower Packs", slug: "daily-puja-flower-packs", summary: "Small mixed packs sized for a household's daily puja." },
  { name: "Special Puja Offerings", slug: "special-puja-offerings", summary: "Flowers and leaves put together for specific pujas and rituals." },
];

export const COLLECTIONS = [
  { name: "Durga Puja", slug: "durga-puja-flowers", summary: "Flowers commonly needed during Durga Puja." },
  { name: "Lakshmi Puja", slug: "lakshmi-puja-flowers", summary: "Flowers commonly offered at Lakshmi Puja." },
  { name: "Kali Puja and Diwali", slug: "kali-puja-and-diwali-flowers", summary: "Flowers and garlands for Kali Puja and Diwali." },
  { name: "Saraswati Puja", slug: "saraswati-puja-flowers", summary: "Flowers commonly used for Saraswati Puja." },
  { name: "Maha Shivratri", slug: "maha-shivratri-flowers", summary: "Bel leaves and flowers often offered on Maha Shivratri." },
];

export const FAQS: { topic: string; question: string; answer: string }[] = [
  { topic: "ordering", question: "Do I need an account to order?", answer: "No. You can shop and check out as a guest. Your cart is saved in this browser on this device until you place your order." },
  {
    topic: "ordering",
    question: "How do I know exactly what a price includes?",
    answer: "Every price shows its unit, for example per piece, per bunch, per garland, per pack or per weight. Your cart shows the quantity, the price per unit and the total for each item.",
  },
  { topic: "ordering", question: "How can I track my order?", answer: "Use the link on your order confirmation page, or open Track Order and enter your order number with the mobile number you used at checkout." },
  {
    topic: "ordering",
    question: "Can I change or cancel my order?",
    answer: "Contact us as soon as possible with your order number. Flowers are perishable, so changes may not be possible once your order is being prepared.",
  },
  {
    topic: "delivery",
    question: "Do you deliver to my area?",
    answer: "Enter your PIN code on a product page, in your cart or at checkout to check. If we do not deliver there yet, you can still contact us or send a bulk enquiry.",
  },
  {
    topic: "delivery",
    question: "Can I choose a delivery date and time?",
    answer: "Yes. At checkout you can choose from the dates and time slots available for your PIN code. Each slot closes some time before it starts so that your flowers can be prepared fresh.",
  },
  { topic: "delivery", question: "How much is delivery?", answer: "The delivery fee depends on your delivery area. It is shown in your cart once you enter your PIN code, before you pay." },
  {
    topic: "payment",
    question: "Which payment methods can I use?",
    answer: "The payment methods available for your order are shown at checkout. Online payments are handled by our payment provider, and we never see or store your card details.",
  },
  {
    topic: "bulk",
    question: "Do you take bulk orders for mandirs and events?",
    answer: "Yes. Send a bulk enquiry with the flowers, quantities and dates you need. We review availability and pricing and contact you with a quotation. An enquiry becomes an order only after we confirm it with you.",
  },
  {
    topic: "bulk",
    question: "Can I arrange a regular supply of flowers?",
    answer: "Yes, you can tell us in your enquiry whether you need flowers daily, weekly, monthly or for a festival season, and we will discuss what we can supply.",
  },
];

export const PAGES: { slug: string; title: string; body: string }[] = [
  {
    slug: "about-us",
    title: "About Swastik",
    body: `Swastik sells puja flowers online for households, mandirs and puja organisers, starting in Rishra, Hooghly, West Bengal.

## What we do

We source flowers through our supply network and prepare orders for delivery in the areas we serve. You can order loose flowers, garlands, leaves and daily puja packs without creating an account, and choose a delivery date and slot that suits your puja.

## Who we serve

Families who need flowers for daily or festival puja, and mandirs, pandits and puja committees who need larger quantities. For large or regular requirements, use our [bulk order enquiry](/bulk-orders).

## Our story

[[confirm: add a few sentences about how Swastik started and who runs it]]`,
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    body: `This policy explains what information Swastik collects through this website and how it is used.

## Information we collect

- **Order details:** your name, mobile number, delivery address, PIN code, optional email address, the items you order, your chosen delivery date and slot, and any notes you add.
- **Bulk enquiries and messages:** the contact details and requirements you send us through the bulk enquiry and contact forms.
- **Payments:** online payments are processed by our payment provider. We receive a payment reference and status. We do not receive or store your card number, UPI PIN or bank login details.
- **Your cart:** the items in your cart are saved in your own browser on your device, not on our servers, until you place an order.

## How we use it

We use your information to prepare and deliver your order, to contact you about your order or enquiry, to handle payments and refunds, and to keep records required by law. We send order updates by email only if you give an email address. [[confirm: say whether you will also contact customers by phone, SMS or WhatsApp]]

## Cookies

This website does not use advertising or tracking cookies. [[confirm: update this section if you add analytics or advertising tools]]

## Sharing

We share your details only with those who help us complete your order, such as our payment provider and delivery staff, or when the law requires it. We do not sell your information.

## How long we keep it

[[confirm: how long order records are kept, for example for accounting and tax purposes]]

## Your choices

You can ask us to correct your details or to delete information we no longer need to keep. Contact us at [[confirm: contact email or phone]].

## Changes

We will update this page if this policy changes. Last updated: [[confirm: date]].`,
  },
  {
    slug: "terms-and-conditions",
    title: "Terms and Conditions",
    body: `These terms apply to orders placed on this website with Swastik, [[confirm: legal business name and address]].

## Orders

An order is placed when you complete checkout and receive an order number. We may contact you if an item is unavailable. [[confirm: what happens when an item is unavailable, for example substitution with your consent or a refund for that item]]

## Prices

Prices are in Indian Rupees and show the unit they apply to. The total you pay, including any delivery fee and discount, is shown before you place the order.

## Delivery

We deliver only to the PIN codes shown as serviceable on this website, on the date and in the slot you choose. [[confirm: what happens if nobody is available to receive the delivery]]

## Natural products

Flowers are natural and seasonal. Colour, size and fragrance can vary from photographs and from one delivery to the next.

## Contact

[[confirm: contact details for questions about these terms]]`,
  },
  {
    slug: "cancellation-and-refund-policy",
    title: "Cancellation and Refund Policy",
    body: `Flowers are perishable, so we have to prepare your order before delivery. This policy explains when you can cancel and how refunds work.

## Cancelling an order

[[confirm: until when a customer can cancel, for example until the order is confirmed or a number of hours before the delivery slot]]

## Refunds

[[confirm: when you give refunds, for example for cancelled orders, missing items or flowers that arrive damaged, and how customers should report a problem]]

Refunds for online payments go back to the original payment method. Banks and UPI apps usually take a few working days to show the refund. [[confirm: how refunds for Cash on Delivery orders are paid, if you offer Cash on Delivery]]`,
  },
  {
    slug: "delivery-policy",
    title: "Delivery Policy",
    body: `## Where we deliver

We deliver to the PIN codes listed on our [delivery information](/delivery) page. Enter your PIN code at checkout to see the dates and slots available to you.

## Delivery dates and slots

You choose a delivery date and time slot at checkout. Each slot closes some time before it starts. [[confirm: how you handle delays, for example traffic or bad weather]]

## Delivery fees

The delivery fee for your area is shown in your cart and at checkout before you pay.

## Receiving your order

[[confirm: what happens if nobody is available at the address]]`,
  },
];

export const GUIDES: { slug: string; title: string; excerpt: string; category?: string; body: string }[] = [
  {
    slug: "flowers-commonly-used-in-daily-puja",
    title: "Flowers commonly used in daily puja",
    excerpt: "A simple guide to the flowers and leaves many households use for everyday worship, and how traditions differ.",
    category: "daily-puja-flower-packs",
    body: `Many households offer fresh flowers every day as part of their puja. Which flowers are used depends on the family, the community, the deity worshipped and the season. This guide describes some of the most common choices. When in doubt, follow your family's practice or ask your priest.

## Marigold (genda)

Marigold is one of the most widely used puja flowers in India. Its orange and yellow flowers are offered loose, strung into garlands and used to decorate the altar. Marigolds stay fresh longer than many softer flowers, which makes them practical for daily use.

## Hibiscus (jaba)

In Bengal, the red hibiscus, known as jaba, is closely associated with the worship of Goddess Kali, and it is also offered to other forms of the Goddess. Many families keep a jaba plant at home for this reason.

## Rose

Roses and rose petals are offered to many deities and are often used in garlands. Petals are also scattered during aarti and special pujas.

## Jasmine and other white flowers

Fragrant white flowers such as jasmine, mogra and bela are popular for their scent. They are often strung into small garlands or offered loose.

## Lotus

The lotus is associated with Goddess Lakshmi and Goddess Saraswati and holds a special place in worship. It is usually offered on special occasions rather than every day. During Durga Puja, lotuses are offered in large numbers, especially for the Sandhi Puja.

## Leaves and grasses

- **Bel (bilva) leaves** are offered to Lord Shiva, usually as a set of three leaflets on one stalk.
- **Durva grass** is commonly offered to Lord Ganesha.
- **Tulsi** is closely associated with Lord Vishnu and Lord Krishna.

## A note on tradition

Practices vary between regions, communities and temples, and some families have their own customs about which flowers to offer to which deity. This guide is a general introduction, not a set of rules. If you would like flowers for a particular puja, browse our [daily puja flower packs](/category/daily-puja-flower-packs) or [contact us](/contact).`,
  },
  {
    slug: "how-to-choose-fresh-puja-flowers",
    title: "How to choose fresh puja flowers",
    excerpt: "What to look for in marigolds, roses, jasmine, hibiscus, lotus and bel leaves so your offerings look and smell their best.",
    body: `Fresh flowers look better on the altar, keep their fragrance longer and last through the puja. Here are simple checks you can use whether you buy flowers in person or receive them at home.

## General signs of freshness

- Petals are firm and full, not limp, papery or wrinkled.
- There are no brown or black edges and no soft, slimy patches.
- Stems, where there are any, look moist and green at the cut end.
- The flowers smell fresh. A sour smell usually means they are past their best.

## Flower by flower

- **Marigold:** heads should feel tight and full, with petals that do not fall away when you touch them gently.
- **Rose:** buds that are just beginning to open last longer than fully open blooms. Outer petals with slight marks are normal and can be removed.
- **Jasmine and mogra:** buds and half-open flowers keep their scent longest. Fully open flowers that have turned yellowish are older.
- **Hibiscus:** hibiscus flowers naturally last only a short time after opening, so they are best used on the day you receive them.
- **Lotus:** closed or half-open buds with smooth, unbruised petals open gradually and last longer.
- **Bel leaves:** look for green, unbroken leaflets that are not dry or spotted.

## Timing matters

Plan to receive flowers close to the time of your puja, especially soft flowers such as jasmine and hibiscus. If you order from us, choose the delivery slot nearest to when you need them.`,
  },
  {
    slug: "how-to-keep-puja-flowers-fresh",
    title: "How to keep puja flowers fresh until your puja",
    excerpt: "Practical ways to store loose flowers, garlands and leaves for a few hours or overnight.",
    body: `Sometimes flowers arrive a few hours, or a night, before they are needed. These steps help them stay fresh.

## As soon as they arrive

- Unpack the flowers and remove any plastic wrapping so they can breathe.
- Keep them in a cool, shaded place, away from direct sunlight, the stove and fans blowing directly on them.
- Keep flowers away from ripening fruit. Fruit gives off a gas called ethylene that makes flowers age faster.

## Loose flowers and garlands

- Sprinkle a little water over marigolds and garlands. Do not soak them.
- Wrap jasmine and other delicate white flowers loosely in a clean, damp cotton cloth.
- For overnight storage, place flowers in a covered container in the vegetable section of a refrigerator. Do not freeze them, and keep them away from the coldest part of the refrigerator.

## Flowers with stems

Trim the ends of the stems and stand them in clean water. Change the water if you are keeping them for more than a day.

## Leaves

Wrap bel leaves, tulsi and other puja leaves in a damp cloth and keep them in a cool place so they do not dry out.

## Before the puja

Take refrigerated flowers out a little while before the puja so they return to room temperature, and remove any petals that have wilted.`,
  },
  {
    slug: "planning-flower-quantities-for-mandirs-and-events",
    title: "Planning flower quantities for a mandir or community puja",
    excerpt: "A step-by-step way to work out how many flowers and garlands to order for temple worship and religious events.",
    category: "flower-garlands",
    body: `Ordering the right quantity of flowers for a temple or a community puja avoids last-minute shortages and waste. The exact amounts depend on your rituals, so start with a simple plan and check it with your priest.

## 1. List what the flowers are for

Write down each use separately:

- Garlands for each deity, and their lengths.
- Loose flowers for offerings (pushpanjali) and aarti.
- Decoration of the altar, the pandal, entrances and stages.
- Special rituals that need particular flowers or counts.

## 2. Count by day

For events lasting several days, plan each day separately. Some offerings are made daily, while decoration may only need to be refreshed every few days.

## 3. Note any fixed counts

Some rituals call for a set number of flowers or leaves. Ask your priest for these numbers and include them exactly.

## 4. Add a margin

Natural flowers vary in size, and some may be damaged in handling. Many organisers add a small extra margin to loose flowers, especially for offerings shared by many devotees.

## 5. Order early for festivals

Demand for flowers rises sharply before major festivals. Share your requirements well in advance so that supply can be arranged.

## Send us your plan

Use our [bulk order enquiry](/bulk-orders) to list each flower variety, the quantity and the unit (for example kilograms, pieces or garlands). You can add several varieties in one enquiry, and we will contact you to confirm availability and pricing.`,
  },
  {
    slug: "how-to-order-puja-flowers-in-bulk",
    title: "How to order puja flowers in bulk for a mandir",
    excerpt: "How Swastik's bulk enquiry works for temples, pandits, puja committees and event organisers.",
    body: `Mandirs, pandits, puja committees and event organisers often need more flowers than a household order, or need them regularly. Swastik handles these orders through a simple enquiry and quotation process.

## How it works

1. **Send an enquiry.** Open the [bulk orders page](/bulk-orders) and fill in the form. Add each flower variety you need with its quantity and unit, the date you need it, and the delivery address.
2. **We review it.** We check availability and pricing for your requirements.
3. **We contact you.** We call or message you on the number you give us to discuss the details and share a quotation.
4. **You confirm.** Once you agree to the quotation, we confirm the delivery and payment arrangements with you.

An enquiry is not a confirmed order. Your order is confirmed only when we confirm it with you.

## One-time and regular requirements

In the enquiry you can say whether this is a one-time requirement, or whether you need flowers daily, weekly, monthly or for a festival season.

## Tips for a quick quotation

- Use the units you normally buy in, such as kilograms for loose marigold or pieces for lotus.
- Mention garland lengths and any colour preferences.
- Add any timing needs, for example flowers needed before a morning aarti.

If you are planning quantities for the first time, our guide to [planning flower quantities](/guides/planning-flower-quantities-for-mandirs-and-events) may help.`,
  },
];
