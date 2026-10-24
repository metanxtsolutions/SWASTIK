import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getEnv } from "../env";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;
/** A database handle or an open transaction; services accept either. */
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbOrTx = Database | Tx;

// One pool per server instance, kept across hot reloads in development.
const globalForDb = globalThis as unknown as { __swastikPool?: Pool; __swastikDb?: Database };

export function getPool(): Pool {
  if (!globalForDb.__swastikPool) {
    const env = getEnv();
    globalForDb.__swastikPool = new Pool({
      connectionString: env.DATABASE_URL,
      max: env.DATABASE_POOL_MAX,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalForDb.__swastikPool;
}

export function getDb(): Database {
  if (!globalForDb.__swastikDb) {
    globalForDb.__swastikDb = drizzle({ client: getPool(), schema, casing: "snake_case" });
  }
  return globalForDb.__swastikDb;
}

export async function closeDb(): Promise<void> {
  await globalForDb.__swastikPool?.end();
  globalForDb.__swastikPool = undefined;
  globalForDb.__swastikDb = undefined;
}

export { schema };
