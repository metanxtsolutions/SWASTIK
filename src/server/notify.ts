import nodemailer, { type Transporter } from "nodemailer";
import type { DbOrTx } from "./db/client";
import { notifications } from "./db/schema";
import { getEnv, type Env } from "./env";

/**
 * Email notifications. With EMAIL_DRIVER=smtp messages are delivered through any
 * transactional provider's SMTP service (Amazon SES, Zoho, Brevo, Postmark,
 * Resend). With EMAIL_DRIVER=outbox nothing is delivered: the message is stored
 * and the admin panel shows it as "not configured", so nobody is told an email
 * went out when it did not. WhatsApp and SMS providers are not integrated yet.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  template: string;
  orderId?: string | null;
  enquiryId?: string | null;
}

let transporter: Transporter | null = null;
let transportOverride: Pick<Transporter, "sendMail"> | null = null;

export function setTransportForTests(t: Pick<Transporter, "sendMail"> | null) {
  transportOverride = t;
}

function transport(env: Env): Pick<Transporter, "sendMail"> {
  if (transportOverride) return transportOverride;
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_TLS === "implicit",
    requireTLS: env.SMTP_TLS === "starttls",
    ignoreTLS: env.SMTP_TLS === "none",
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transporter;
}

export function emailConfigured(env: Env = getEnv()): boolean {
  return env.EMAIL_DRIVER === "smtp" && !!env.SMTP_HOST;
}

const SENSITIVE_TEMPLATES = new Set(["admin_password_reset"]);

export async function sendEmail(db: DbOrTx, msg: EmailMessage): Promise<"sent" | "stored" | "failed" | "not_configured"> {
  const env = getEnv();
  // One-time links (password resets) are never kept in the log outside local development.
  const loggedBody = SENSITIVE_TEMPLATES.has(msg.template) && env.APP_STAGE !== "development" ? "(Content not stored: contains a one-time link.)" : msg.body;
  if (!emailConfigured(env)) {
    const status = env.APP_STAGE === "production" ? "not_configured" : "stored";
    // Development convenience: reset links and order emails can be read from the server log.
    if (env.APP_STAGE === "development" && env.NODE_ENV !== "test") console.info(`[email not sent: EMAIL_DRIVER=outbox] to=${msg.to} subject="${msg.subject}"\n${msg.body}`);
    await db.insert(notifications).values({ channel: "email", template: msg.template, recipient: msg.to, subject: msg.subject, body: loggedBody, status, orderId: msg.orderId ?? null, enquiryId: msg.enquiryId ?? null });
    return status;
  }
  try {
    await transport(env).sendMail({ from: env.EMAIL_FROM, to: msg.to, subject: msg.subject, text: msg.body });
    await db.insert(notifications).values({ channel: "email", template: msg.template, recipient: msg.to, subject: msg.subject, body: loggedBody, status: "sent", orderId: msg.orderId ?? null, enquiryId: msg.enquiryId ?? null });
    return "sent";
  } catch (e) {
    const error = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    console.error(JSON.stringify({ level: "error", msg: "email_failed", template: msg.template, error }));
    await db.insert(notifications).values({ channel: "email", template: msg.template, recipient: msg.to, subject: msg.subject, body: loggedBody, status: "failed", error, orderId: msg.orderId ?? null, enquiryId: msg.enquiryId ?? null });
    return "failed";
  }
}
