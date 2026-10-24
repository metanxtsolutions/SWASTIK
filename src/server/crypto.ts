import "server-only";
import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getEnv } from "./env";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, keylen: number, opts: object) => Promise<Buffer>;

// scrypt N=2^15, r=8, p=1: a memory-hard hash that keeps serverless login latency acceptable.
// Parameters are stored with each hash so they can be raised later without breaking old hashes.
const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize("NFKC"), salt, 32, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, N, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, "base64");
  const key = await scryptAsync(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT.maxmem,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** A hash that takes as long as a real check, so unknown emails cannot be told apart by timing. */
export const DUMMY_PASSWORD_HASH = "scrypt$32768$8$1$c3dhc3Rpay1kdW1teS1zYWx0$0pQ8Bzo1tYxkF6m1xS0s2v3l0cV3c0bQe0r1o2m3a4E=";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Keyed hash for storing bearer tokens (admin sessions, reset links, order access links). */
export function hashToken(token: string): string {
  return createHmac("sha256", getEnv().AUTH_SECRET).update(token).digest("hex");
}

export function hmacSha256Hex(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Random reference without ambiguous characters (no 0/O, 1/I/L). Not sequential, so it cannot be guessed. */
export function randomReference(prefix: string, length = 8): string {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return `${prefix}-${out}`;
}

/** Short keyed hash of an IP address for rate-limit keys, so raw addresses are not stored. */
export function hashIp(ip: string | null | undefined): string {
  return createHmac("sha256", getEnv().AUTH_SECRET).update(`ip:${ip ?? "unknown"}`).digest("hex").slice(0, 24);
}
