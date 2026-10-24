import { afterAll, beforeEach } from "vitest";
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "@/server/db/client";
import { resetEnvCache } from "@/server/env";
import { setGatewayForTests } from "@/server/payments";

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://swastik:swastik@localhost:5432/swastik_test";
(process.env as Record<string, string>).NODE_ENV = "test";
process.env.APP_STAGE = "development";
process.env.PAYMENT_GATEWAY = "mock";
process.env.EMAIL_DRIVER = "outbox";
process.env.STORAGE_DRIVER = "database";
resetEnvCache();

beforeEach(async () => {
  setGatewayForTests(null);
  resetEnvCache();
  const db = getDb();
  const tables = await db.execute<{ tablename: string }>(sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
  const names = tables.rows.map((r) => `"${r.tablename}"`).join(", ");
  if (names) await db.execute(sql.raw(`TRUNCATE ${names} RESTART IDENTITY CASCADE`));
});

afterAll(async () => {
  await closeDb();
});
