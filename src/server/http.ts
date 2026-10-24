import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getEnv } from "./env";
import { AppError } from "./errors";

/** JSON error response. Only AppError messages reach the client; anything else is logged and hidden. */
export function errorResponse(e: unknown): NextResponse {
  if (e instanceof AppError) return NextResponse.json({ error: e.message, fieldErrors: e.fieldErrors ?? {} }, { status: e.status });
  if (e instanceof ZodError) return NextResponse.json({ error: "Invalid request", fieldErrors: {} }, { status: 422 });
  console.error(JSON.stringify({ level: "error", msg: "unhandled_api_error", error: e instanceof Error ? `${e.name}: ${e.message}` : String(e), stack: e instanceof Error ? e.stack : undefined }));
  return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
}

/**
 * Rejects cross-site POSTs to JSON endpoints: browsers send Origin on POST, and it
 * must match this site. Webhooks (server to server) do not use this check.
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const o = new URL(origin);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return o.host === host || o.origin === new URL(getEnv().APP_URL).origin;
  } catch {
    return false;
  }
}

export function requestIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
}

export async function readJson(req: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new AppError("Request too large");
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("Invalid request");
  }
}
