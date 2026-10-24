# Design system

The look combines warm, premium floral presentation with plain, fast e-commerce navigation. Tokens live in `src/app/globals.css` (Tailwind CSS 4 `@theme`), so classes such as `bg-saffron` and `text-ink-soft` come from one place.

## Colour

| Token | Hex | Use |
|---|---|---|
| `ink` | #2b1d14 | Body text and headings (warm near-black) |
| `ink-soft` / `muted` | #4a3a2e / #6b5a4c | Secondary text, hints |
| `cream` | #fff9f1 | Page background |
| `paper` | #ffffff | Cards, inputs |
| `sand` / `sand-deep` / `line` | #f6ecdf / #ecdcc6 / #e6d8c5 | Image backgrounds, skeletons, borders |
| `saffron` / `saffron-dark` | #b4530a / #8f4006 | Primary buttons and links (white text on saffron is 5.3:1) |
| `saffron-soft` | #fdebd3 | Selected states, chips |
| `marigold` / `marigold-soft` | #f4a020 / #fff3dc | Decoration and focus rings only (not for text on white) |
| `kumkum` / `kumkum-soft` | #9b1c3a / #fbe7ec | Bulk orders block, announcement bar, offer badge |
| `leaf` / `leaf-soft` | #2f6b3f / #e5f1e6 | Success, in stock, delivery confirmed |
| `danger` / `danger-soft` | #b42318 / #fdecea | Errors, not serviceable |
| `info` / `info-soft` | #1d5c8c / #e7f1f9 | Preview banner, test mode |

Religious symbols are deliberately avoided in the interface. The brand mark is a stylised eight-petal marigold.

## Type

- **Display:** Fraunces (variable, self-hosted through `@fontsource-variable/fraunces`) for headings.
- **Text:** Inter (variable, self-hosted) for everything else.
- Fallbacks include Noto Sans Bengali and Noto Sans Devanagari for future Bengali and Hindi content.
- Form inputs use 16 px text so phones do not zoom in on focus.

## Components

| Component | File | Notes |
|---|---|---|
| Buttons | `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.btn-sm` | 44 px minimum height (36 px for small) for touch |
| Card | `.card` | White, 1 px border, soft shadow, 16 px radius |
| Fields | `.field-label`, `.field-input`, `.field-error`, `.field-hint` | `aria-invalid` turns the border red |
| Chips and badges | `.chip`, admin `Badge` | Status colours above |
| Product card | `components/shop/product-card.tsx` | Square image, category, name, price with unit ("₹40 per 250 g pack"), Add or Choose button, stock badges |
| Quantity stepper | `components/shop/quantity-stepper.tsx` | Large touch targets, respects minimum and maximum |
| Delivery check | `components/shop/delivery-check.tsx` | Used in the header dialog, home page, product page and delivery page |
| Empty state | `components/shop/empty-state.tsx` | Illustration, message and one action |
| FAQ list | `components/shop/faq-list.tsx` | Native `details` elements, no JavaScript needed |
| Markdown | `components/markdown.tsx` | Safe subset for owner content; never renders raw HTML |

## Illustrations

`src/lib/illustrations.ts` draws original flower illustrations in SVG (marigold, rose, jasmine, hibiscus, lotus, bel leaves, garland, bundle, daily pack, festival). They appear when a product, category or hero has no photo yet, with alt text that says they are illustrations. The sample catalogue renders them to WebP. Real product photos should replace them before launch.

## Layout and responsiveness

- `.container-page`: maximum 80 rem, 16 px side padding on phones, 24 px from 640 px.
- Phones: compact header (logo, PIN chip, cart), full-width search below it, scrolling category chips, two-column product grid, horizontally scrolling product rails, bottom navigation (Home, Shop, Bulk orders, Cart).
- Product, cart and checkout pages hide the bottom navigation and show their own sticky action bar instead, so navigation never covers the Add to cart, Checkout or Pay buttons.
- Tablets: three-column grids. Desktops: four columns, sticky order summaries, filter sidebar.
- `fieldset` has `min-width: 0` globally, and grids that hold wide rows use `minmax(0, 1fr)`, so nothing widens the page on small phones. The end-to-end tests check 360, 768 and 1280 px for sideways scrolling.

## Accessibility

- Skip link, landmarks, one `h1` per page, labelled form controls, `aria-live` regions for cart, delivery and form results, visible focus rings (3 px marigold outline), `prefers-reduced-motion` respected.
- Radio groups for options, dates and slots; the search box is a combobox with keyboard navigation.
- Contrast: text tokens meet WCAG AA on cream and white.

## Interface states covered

Loading skeletons (cart, checkout, quotes), empty search, empty cart, out of stock (cards, product options), invalid and unserviced PIN codes, closed or full delivery slots, minimum order not met, checkout failure with kept form values, payment pending (with polling), payment failure (with retry), payment expired, success, offline or network errors with retry, missing images (illustrations), invalid promo codes, ordering paused, and a branded 404.
