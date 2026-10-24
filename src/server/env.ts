import { z } from "zod";

/**
 * Server-only configuration. Secrets never use the NEXT_PUBLIC_ prefix, so
 * Next.js never bundles them for the browser.
 *
 * Business details (phone, WhatsApp, address, delivery areas, Cash on Delivery)
 * are not configured here: the owner manages them in the admin panel.
 */

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // development | preview | production. "preview" is a hosted demo: production build,
  // test-mode payments only, a visible banner, and search engines told not to index it.
  APP_STAGE: z.enum(["development", "preview", "production"]).optional(),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1).default("postgres://swastik:swastik@localhost:5432/swastik_dev"),
  // Serverless functions each hold their own pool, so keep it small and use a pooled connection string.
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
  AUTH_SECRET: z.string().min(32).default("dev-only-auth-secret-change-me-0123456789abcdef"),
  CRON_SECRET: z.string().default(""),
  // Enables the one-time /admin/setup page while no administrator exists.
  ADMIN_SETUP_TOKEN: z.string().default(""),

  EMAIL_DRIVER: z.enum(["outbox", "smtp"]).default("outbox"),
  EMAIL_FROM: z.string().default("Swastik <no-reply@localhost>"),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASSWORD: z.string().default(""),
  SMTP_TLS: z.enum(["starttls", "implicit", "none"]).default("starttls"),

  // local: files on disk (development only). database: files in PostgreSQL. s3: any S3-compatible store (Cloudflare R2, AWS S3).
  STORAGE_DRIVER: z.enum(["local", "database", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./storage"),
  STORAGE_ENDPOINT: z.string().default(""),
  STORAGE_REGION: z.string().default("auto"),
  STORAGE_BUCKET: z.string().default(""),
  STORAGE_ACCESS_KEY: z.string().default(""),
  STORAGE_SECRET_KEY: z.string().default(""),

  // none: online payment unavailable. mock: simulated test gateway (never in production). razorpay: Razorpay Standard Checkout.
  PAYMENT_GATEWAY: z.enum(["none", "mock", "razorpay"]).default("mock"),
  RAZORPAY_KEY_ID: z.string().default(""),
  RAZORPAY_KEY_SECRET: z.string().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(""),
  MOCK_WEBHOOK_SECRET: z.string().default("dev-only-mock-webhook-secret"),
});

export type Env = Omit<z.infer<typeof schema>, "APP_STAGE"> & { APP_STAGE: "development" | "preview" | "production" };

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n")}`);
  }
  const raw = parsed.data;
  const env: Env = { ...raw, APP_STAGE: raw.APP_STAGE ?? (raw.NODE_ENV === "production" ? "production" : "development") };
  // Next.js builds pages with NODE_ENV=production; only check runtime safety for real production stages.
  if (env.APP_STAGE === "production" && process.env.NEXT_PHASE !== "phase-production-build") assertProductionSafe(env);
  cached = env;
  return env;
}

export function setEnvForTests(overrides: Partial<Env>): void {
  cached = { ...getEnv(), ...overrides };
}

export function resetEnvCache(): void {
  cached = null;
}

export const DEV_AUTH_SECRET = "dev-only-auth-secret-change-me-0123456789abcdef";

function assertProductionSafe(env: Env): void {
  const problems: string[] = [];
  if (env.AUTH_SECRET === DEV_AUTH_SECRET) problems.push("AUTH_SECRET must be set to a real secret");
  if (!env.APP_URL.startsWith("https://")) problems.push("APP_URL must use https");
  if (env.CRON_SECRET.length < 32) problems.push("CRON_SECRET must be at least 32 characters");
  if (env.STORAGE_DRIVER === "local") problems.push("STORAGE_DRIVER=local does not persist on Vercel; use s3 or database");
  if (env.PAYMENT_GATEWAY === "mock") problems.push("PAYMENT_GATEWAY=mock simulates payments and is not allowed in production (use razorpay or none)");
  if (env.PAYMENT_GATEWAY === "razorpay" && (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET || !env.RAZORPAY_WEBHOOK_SECRET)) {
    problems.push("RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET are required when PAYMENT_GATEWAY=razorpay");
  }
  if (env.EMAIL_DRIVER === "smtp" && !env.SMTP_HOST) problems.push("SMTP_HOST is required when EMAIL_DRIVER=smtp");
  if (env.EMAIL_DRIVER === "smtp" && env.SMTP_TLS === "none") problems.push("SMTP_TLS=none sends credentials in clear text");
  if (env.ADMIN_SETUP_TOKEN && env.ADMIN_SETUP_TOKEN.length < 24) problems.push("ADMIN_SETUP_TOKEN must be at least 24 characters");
  if (problems.length) throw new Error(`Unsafe production configuration:\n${problems.join("\n")}`);
}

/** True for the hosted preview and local development: shows a banner and keeps search engines away. */
export function isNonProduction(env: Env = getEnv()): boolean {
  return env.APP_STAGE !== "production";
}
