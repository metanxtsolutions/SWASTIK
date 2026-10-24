import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://swastik:swastik@localhost:5432/swastik_test";

/** Rebuilds the test database schema from the migrations once per run. */
export default async function setup() {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  await client.query("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  await client.end();
}
