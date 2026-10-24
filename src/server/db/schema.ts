import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Database schema. Column names are converted to snake_case (see client.ts and
 * drizzle.config.ts). Money is stored as integer paise. Orders keep snapshots
 * of product names, units and prices so catalogue edits never rewrite history.
 */

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });
const ts = (name?: string) => (name ? timestamp(name, { withTimezone: true }) : timestamp({ withTimezone: true }));
const createdAt = () => ts().notNull().defaultNow();
const updatedAt = () => ts().notNull().defaultNow();

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const productStatus = pgEnum("product_status", ["draft", "published", "archived"]);
export const saleUnit = pgEnum("sale_unit", ["piece", "bunch", "bundle", "kg", "gram", "garland", "pack", "dozen", "string", "plate", "box", "set"]);
export const orderStatus = pgEnum("order_status", [
  "pending_payment",
  "pending_confirmation",
  "confirmed",
  "preparing",
  "ready_for_dispatch",
  "out_for_delivery",
  "delivered",
  "cancelled",
]);
export const paymentStatus = pgEnum("payment_status", ["unpaid", "pending", "paid", "failed", "refund_pending", "partially_refunded", "refunded"]);
export const paymentMethod = pgEnum("payment_method", ["online", "cod"]);
export const paymentAttemptStatus = pgEnum("payment_attempt_status", ["created", "captured", "failed", "expired"]);
export const refundStatus = pgEnum("refund_status", ["pending", "processed", "failed", "recorded"]);
export const enquiryStatus = pgEnum("enquiry_status", ["new", "contacted", "quoted", "accepted", "converted", "declined", "closed"]);
export const enquiryFrequency = pgEnum("enquiry_frequency", ["one_time", "daily", "weekly", "monthly", "festival_season", "other"]);
export const couponType = pgEnum("coupon_type", ["percent", "fixed", "free_delivery"]);
export const notificationStatus = pgEnum("notification_status", ["sent", "stored", "failed", "not_configured"]);

// ---------------------------------------------------------------------------
// Administrator (exactly one) and security
// ---------------------------------------------------------------------------

export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid().primaryKey().defaultRandom(),
    // Always true and unique: the table can hold one row only, so there is one master administrator.
    singleton: boolean().notNull().default(true),
    email: text().notNull(),
    name: text().notNull(),
    passwordHash: text().notNull(),
    passwordChangedAt: ts().notNull().defaultNow(),
    lastLoginAt: ts(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("admin_users_singleton_idx").on(t.singleton), check("admin_users_singleton_true", sql`${t.singleton}`)],
);

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    adminId: uuid()
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    tokenHash: text().notNull().unique(),
    ip: text(),
    userAgent: text(),
    createdAt: createdAt(),
    lastSeenAt: ts().notNull().defaultNow(),
    expiresAt: ts().notNull(),
    revokedAt: ts(),
  },
  (t) => [index("admin_sessions_admin_idx").on(t.adminId)],
);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid().primaryKey().defaultRandom(),
  adminId: uuid()
    .notNull()
    .references(() => adminUsers.id, { onDelete: "cascade" }),
  tokenHash: text().notNull().unique(),
  expiresAt: ts().notNull(),
  usedAt: ts(),
  createdAt: createdAt(),
});

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text().notNull(),
    windowStart: ts().notNull(),
    count: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid().primaryKey().defaultRandom(),
    actor: text().notNull(), // "admin:<email>", "system", "customer"
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: text(),
    details: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    ip: text(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt), index("audit_logs_entity_idx").on(t.entityType, t.entityId)],
);

// ---------------------------------------------------------------------------
// Settings and media
// ---------------------------------------------------------------------------

/** Key-value business settings; each key has a Zod schema in src/server/services/settings.ts. */
export const settings = pgTable("settings", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: updatedAt(),
});

export const media = pgTable("media", {
  id: uuid().primaryKey().defaultRandom(),
  // Identical files share one stored object (the key is derived from the content hash).
  storageKey: text().notNull(),
  filename: text().notNull(),
  contentType: text().notNull(),
  size: integer().notNull(),
  width: integer(),
  height: integer(),
  sha256: text().notNull(),
  alt: text().notNull().default(""),
  createdAt: createdAt(),
});

/** File bytes for STORAGE_DRIVER=database. */
export const storedObjects = pgTable("stored_objects", {
  key: text().primaryKey(),
  contentType: text().notNull(),
  size: integer().notNull(),
  bytes: bytea().notNull(),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export const categories = pgTable("categories", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  summary: text().notNull().default(""),
  intro: text().notNull().default(""), // longer, helpful introduction for the category page
  imageId: uuid().references(() => media.id, { onDelete: "set null" }),
  sortOrder: integer().notNull().default(0),
  isVisible: boolean().notNull().default(true),
  seoTitle: text().notNull().default(""),
  seoDescription: text().notNull().default(""),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Festival and occasion collections. */
export const collections = pgTable("collections", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  summary: text().notNull().default(""),
  intro: text().notNull().default(""),
  imageId: uuid().references(() => media.id, { onDelete: "set null" }),
  sortOrder: integer().notNull().default(0),
  isVisible: boolean().notNull().default(true),
  startsOn: date(),
  endsOn: date(),
  seoTitle: text().notNull().default(""),
  seoDescription: text().notNull().default(""),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const products = pgTable(
  "products",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    slug: text().notNull().unique(),
    categoryId: uuid().references(() => categories.id, { onDelete: "restrict" }),
    shortDescription: text().notNull().default(""),
    description: text().notNull().default(""),
    usageInfo: text().notNull().default(""), // occasions and how it is commonly used
    careInfo: text().notNull().default(""),
    unit: saleUnit().notNull().default("piece"),
    tags: text().array().notNull().default(sql`'{}'::text[]`),
    status: productStatus().notNull().default("draft"),
    isFeatured: boolean().notNull().default(false),
    isBestseller: boolean().notNull().default(false),
    sortOrder: integer().notNull().default(0),
    seoTitle: text().notNull().default(""),
    seoDescription: text().notNull().default(""),
    publishedAt: ts(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("products_category_idx").on(t.categoryId), index("products_status_idx").on(t.status)],
);

/** Every product has at least one variant: the sellable unit with its own SKU, price and stock. */
export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    label: text().notNull().default(""), // e.g. "250 g", "Bunch of 10 stems"; empty for single-option products
    sku: text().notNull().unique(),
    unit: saleUnit().notNull().default("piece"),
    pricePaise: integer().notNull(),
    salePricePaise: integer(),
    trackInventory: boolean().notNull().default(true),
    stockQuantity: integer().notNull().default(0),
    minOrderQty: integer().notNull().default(1),
    maxOrderQty: integer(),
    isActive: boolean().notNull().default(true),
    sortOrder: integer().notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("product_variants_product_idx").on(t.productId),
    check("variant_price_positive", sql`${t.pricePaise} > 0`),
    check("variant_sale_price_valid", sql`${t.salePricePaise} IS NULL OR (${t.salePricePaise} > 0 AND ${t.salePricePaise} < ${t.pricePaise})`),
    check("variant_stock_non_negative", sql`${t.stockQuantity} >= 0`),
    check("variant_min_qty", sql`${t.minOrderQty} >= 1`),
    check("variant_max_qty", sql`${t.maxOrderQty} IS NULL OR ${t.maxOrderQty} >= ${t.minOrderQty}`),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    mediaId: uuid()
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    alt: text().notNull().default(""),
    sortOrder: integer().notNull().default(0), // the lowest is the main image
    createdAt: createdAt(),
  },
  (t) => [index("product_images_product_idx").on(t.productId)],
);

export const productCollections = pgTable(
  "product_collections",
  {
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    collectionId: uuid()
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.productId, t.collectionId] })],
);

/** When a product has rows here it is sold only in those delivery zones; no rows means every zone. */
export const productZones = pgTable(
  "product_zones",
  {
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    zoneId: uuid()
      .notNull()
      .references(() => deliveryZones.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.productId, t.zoneId] })],
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid().primaryKey().defaultRandom(),
    variantId: uuid()
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    delta: integer().notNull(),
    reason: text().notNull(), // order_placed, order_released, admin_adjustment, restock
    orderId: uuid(),
    note: text(),
    createdAt: createdAt(),
  },
  (t) => [index("stock_movements_variant_idx").on(t.variantId)],
);

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

export const deliveryZones = pgTable("delivery_zones", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  isActive: boolean().notNull().default(false),
  deliveryFeePaise: integer().notNull().default(0),
  minOrderPaise: integer().notNull().default(0),
  freeDeliveryAbovePaise: integer(),
  // Days between ordering and the earliest delivery date (0 allows same-day when sameDayEnabled).
  minLeadDays: integer().notNull().default(1),
  maxAdvanceDays: integer().notNull().default(14),
  sameDayEnabled: boolean().notNull().default(false),
  sameDayCutoff: time(), // local time (Asia/Kolkata) after which same-day orders close
  instructions: text().notNull().default(""),
  // Optional public landing page for genuinely served areas.
  landingPublished: boolean().notNull().default(false),
  landingTitle: text().notNull().default(""),
  landingContent: text().notNull().default(""),
  sortOrder: integer().notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const zonePincodes = pgTable(
  "zone_pincodes",
  {
    pincode: text().primaryKey(),
    zoneId: uuid()
      .notNull()
      .references(() => deliveryZones.id, { onDelete: "cascade" }),
    localities: text().notNull().default(""),
  },
  (t) => [index("zone_pincodes_zone_idx").on(t.zoneId), check("pincode_format", sql`${t.pincode} ~ '^[1-9][0-9]{5}$'`)],
);

export const deliverySlots = pgTable(
  "delivery_slots",
  {
    id: uuid().primaryKey().defaultRandom(),
    zoneId: uuid()
      .notNull()
      .references(() => deliveryZones.id, { onDelete: "cascade" }),
    label: text().notNull(),
    startTime: time().notNull(),
    endTime: time().notNull(),
    // Orders for this slot close this many minutes before it starts.
    cutoffMinutes: integer().notNull().default(120),
    capacity: integer(), // maximum orders per date; null for no limit
    daysOfWeek: integer().array().notNull().default(sql`'{0,1,2,3,4,5,6}'::int[]`), // 0 = Sunday
    isActive: boolean().notNull().default(true),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [index("delivery_slots_zone_idx").on(t.zoneId)],
);

/** Dates without delivery (all zones when zoneId is null). */
export const deliveryBlackouts = pgTable("delivery_blackouts", {
  id: uuid().primaryKey().defaultRandom(),
  zoneId: uuid().references(() => deliveryZones.id, { onDelete: "cascade" }),
  date: date().notNull(),
  reason: text().notNull().default(""),
});

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

export const coupons = pgTable(
  "coupons",
  {
    id: uuid().primaryKey().defaultRandom(),
    code: text().notNull().unique(), // stored upper-case
    description: text().notNull().default(""),
    type: couponType().notNull(),
    value: integer().notNull().default(0), // percent (1-100) or paise
    minOrderPaise: integer().notNull().default(0),
    maxDiscountPaise: integer(),
    startsAt: ts(),
    endsAt: ts(),
    usageLimit: integer(),
    perPhoneLimit: integer(),
    usedCount: integer().notNull().default(0),
    isActive: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("coupon_value_valid", sql`(${t.type} <> 'percent') OR (${t.value} BETWEEN 1 AND 100)`)],
);

// ---------------------------------------------------------------------------
// Orders and payments
// ---------------------------------------------------------------------------

export const orders = pgTable(
  "orders",
  {
    id: uuid().primaryKey().defaultRandom(),
    // Random, not sequential (e.g. SW-7KD4Q9XM). The customer's order link also carries an
    // access token derived from the order id with AUTH_SECRET (see services/orders.ts).
    orderNumber: text().notNull().unique(),
    idempotencyKey: text().notNull().unique(),
    status: orderStatus().notNull(),
    paymentStatus: paymentStatus().notNull(),
    paymentMethod: paymentMethod().notNull(),
    customerName: text().notNull(),
    phone: text().notNull(),
    email: text(),
    addressLine1: text().notNull(),
    addressLine2: text().notNull().default(""),
    landmark: text().notNull().default(""),
    locality: text().notNull(),
    city: text().notNull(),
    state: text().notNull().default("West Bengal"),
    pincode: text().notNull(),
    zoneId: uuid().references(() => deliveryZones.id, { onDelete: "set null" }),
    zoneName: text().notNull(),
    deliveryDate: date().notNull(),
    slotId: uuid().references(() => deliverySlots.id, { onDelete: "set null" }),
    slotLabel: text().notNull().default(""),
    customerNotes: text().notNull().default(""),
    subtotalPaise: integer().notNull(),
    discountPaise: integer().notNull().default(0),
    deliveryFeePaise: integer().notNull().default(0),
    totalPaise: integer().notNull(),
    refundedPaise: integer().notNull().default(0),
    couponId: uuid().references(() => coupons.id, { onDelete: "set null" }),
    couponCode: text(),
    cancelReason: text(),
    whatsappConsent: boolean().notNull().default(false),
    source: text().notNull().default("web"), // web | bulk_enquiry | admin
    bulkEnquiryId: uuid(),
    paymentExpiresAt: ts(),
    confirmedAt: ts(),
    deliveredAt: ts(),
    cancelledAt: ts(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("orders_created_idx").on(t.createdAt),
    index("orders_status_idx").on(t.status),
    index("orders_phone_idx").on(t.phone),
    index("orders_delivery_date_idx").on(t.deliveryDate),
    check("order_totals_consistent", sql`${t.totalPaise} = ${t.subtotalPaise} - ${t.discountPaise} + ${t.deliveryFeePaise} AND ${t.totalPaise} >= 0`),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid().references(() => products.id, { onDelete: "set null" }),
    variantId: uuid().references(() => productVariants.id, { onDelete: "set null" }),
    productName: text().notNull(),
    variantLabel: text().notNull().default(""),
    sku: text().notNull(),
    unitLabel: text().notNull(),
    imageId: uuid(),
    unitPricePaise: integer().notNull(),
    quantity: integer().notNull(),
    lineTotalPaise: integer().notNull(),
    stockReserved: boolean().notNull().default(false),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), check("order_item_qty_positive", sql`${t.quantity} > 0`)],
);

/** Status history, payment events, internal notes and notifications for an order. */
export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    type: text().notNull(), // created, status, payment, note, refund, notification
    fromStatus: text(),
    toStatus: text(),
    message: text().notNull().default(""),
    isInternal: boolean().notNull().default(true),
    actor: text().notNull().default("system"),
    createdAt: createdAt(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: text().notNull(), // razorpay | mock | cod | manual
    providerOrderId: text().unique(),
    providerPaymentId: text().unique(),
    amountPaise: integer().notNull(),
    status: paymentAttemptStatus().notNull().default("created"),
    method: text(),
    failureReason: text(),
    isTest: boolean().notNull().default(false),
    capturedAt: ts(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("payments_order_idx").on(t.orderId)],
);

export const refunds = pgTable("refunds", {
  id: uuid().primaryKey().defaultRandom(),
  orderId: uuid()
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  paymentId: uuid().references(() => payments.id, { onDelete: "set null" }),
  amountPaise: integer().notNull(),
  status: refundStatus().notNull(),
  providerRefundId: text().unique(),
  reason: text().notNull().default(""),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Every verified gateway webhook, keyed by the provider's event id, so redelivery is processed once. */
export const webhookEvents = pgTable("webhook_events", {
  id: text().primaryKey(),
  provider: text().notNull(),
  type: text().notNull(),
  payload: jsonb().notNull(),
  processedAt: ts(),
  error: text(),
  createdAt: createdAt(),
});

export const couponRedemptions = pgTable(
  "coupon_redemptions",
  {
    id: uuid().primaryKey().defaultRandom(),
    couponId: uuid()
      .notNull()
      .references(() => coupons.id, { onDelete: "cascade" }),
    orderId: uuid()
      .notNull()
      .unique()
      .references(() => orders.id, { onDelete: "cascade" }),
    phone: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("coupon_redemptions_phone_idx").on(t.couponId, t.phone)],
);

// ---------------------------------------------------------------------------
// Bulk enquiries
// ---------------------------------------------------------------------------

export const bulkEnquiries = pgTable(
  "bulk_enquiries",
  {
    id: uuid().primaryKey().defaultRandom(),
    reference: text().notNull().unique(),
    institutionName: text().notNull(),
    contactName: text().notNull(),
    phone: text().notNull(),
    email: text(),
    address: text().notNull(),
    pincode: text().notNull(),
    deliveryDate: date().notNull(),
    preferredTime: text().notNull().default(""),
    frequency: enquiryFrequency().notNull(),
    recurringDetails: text().notNull().default(""),
    instructions: text().notNull().default(""),
    status: enquiryStatus().notNull().default("new"),
    quotedAmountPaise: integer(),
    nextFollowUpAt: ts(),
    convertedOrderId: uuid().references(() => orders.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("bulk_enquiries_status_idx").on(t.status), index("bulk_enquiries_created_idx").on(t.createdAt)],
);

export const bulkEnquiryItems = pgTable("bulk_enquiry_items", {
  id: uuid().primaryKey().defaultRandom(),
  enquiryId: uuid()
    .notNull()
    .references(() => bulkEnquiries.id, { onDelete: "cascade" }),
  flower: text().notNull(),
  quantity: numeric({ precision: 12, scale: 2 }).notNull(),
  unit: text().notNull(),
  notes: text().notNull().default(""),
  sortOrder: integer().notNull().default(0),
});

export const bulkEnquiryNotes = pgTable("bulk_enquiry_notes", {
  id: uuid().primaryKey().defaultRandom(),
  enquiryId: uuid()
    .notNull()
    .references(() => bulkEnquiries.id, { onDelete: "cascade" }),
  kind: text().notNull(), // note | quotation | follow_up | status
  body: text().notNull(),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export const banners = pgTable("banners", {
  id: uuid().primaryKey().defaultRandom(),
  placement: text().notNull().default("hero"), // hero | offer
  eyebrow: text().notNull().default(""),
  title: text().notNull(),
  subtitle: text().notNull().default(""),
  ctaLabel: text().notNull().default(""),
  ctaHref: text().notNull().default(""),
  imageId: uuid().references(() => media.id, { onDelete: "set null" }),
  imageAlt: text().notNull().default(""),
  sortOrder: integer().notNull().default(0),
  isActive: boolean().notNull().default(true),
  startsAt: ts(),
  endsAt: ts(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const faqs = pgTable("faqs", {
  id: uuid().primaryKey().defaultRandom(),
  question: text().notNull(),
  answer: text().notNull(),
  topic: text().notNull().default("general"), // general | ordering | delivery | payment | bulk | product
  categoryId: uuid().references(() => categories.id, { onDelete: "set null" }),
  sortOrder: integer().notNull().default(0),
  isPublished: boolean().notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Policy and information pages served at /<slug>. */
export const pages = pgTable("pages", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  title: text().notNull(),
  body: text().notNull().default(""),
  seoTitle: text().notNull().default(""),
  seoDescription: text().notNull().default(""),
  isPublished: boolean().notNull().default(false),
  showInFooter: boolean().notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Guides and articles at /guides/<slug>. */
export const articles = pgTable("articles", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  title: text().notNull(),
  excerpt: text().notNull().default(""),
  body: text().notNull().default(""),
  coverImageId: uuid().references(() => media.id, { onDelete: "set null" }),
  coverAlt: text().notNull().default(""),
  authorName: text().notNull().default("Swastik"),
  relatedCategoryId: uuid().references(() => categories.id, { onDelete: "set null" }),
  status: productStatus().notNull().default("draft"),
  seoTitle: text().notNull().default(""),
  seoDescription: text().notNull().default(""),
  publishedAt: ts(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Genuine customer reviews entered by the owner, with the customer's permission. */
export const testimonials = pgTable("testimonials", {
  id: uuid().primaryKey().defaultRandom(),
  customerName: text().notNull(),
  locality: text().notNull().default(""),
  body: text().notNull(),
  rating: integer(),
  receivedOn: date(),
  isPublished: boolean().notNull().default(false),
  sortOrder: integer().notNull().default(0),
  createdAt: createdAt(),
});

export const redirects = pgTable("redirects", {
  id: uuid().primaryKey().defaultRandom(),
  fromPath: text().notNull().unique(),
  toPath: text().notNull(),
  permanent: boolean().notNull().default(true),
  hits: bigint({ mode: "number" }).notNull().default(0),
  createdAt: createdAt(),
});

export const contactMessages = pgTable("contact_messages", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  phone: text().notNull(),
  email: text(),
  message: text().notNull(),
  orderNumber: text(),
  isResolved: boolean().notNull().default(false),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const notifications = pgTable(
  "notifications",
  {
    id: uuid().primaryKey().defaultRandom(),
    channel: text().notNull(), // email | whatsapp | sms
    template: text().notNull(),
    recipient: text().notNull(),
    subject: text().notNull().default(""),
    body: text().notNull().default(""),
    status: notificationStatus().notNull(),
    error: text(),
    orderId: uuid().references(() => orders.id, { onDelete: "set null" }),
    enquiryId: uuid().references(() => bulkEnquiries.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_created_idx").on(t.createdAt)],
);
