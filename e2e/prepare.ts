import { execSync } from "node:child_process";
import { Client } from "pg";
import { ADMIN, E2E_DATABASE_URL } from "./constants";

/**
 * Fresh schema, base content, the sample catalogue and an administrator.
 * Runs before the production build, because pages are prerendered from the database.
 */
async function main() {
  const client = new Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  await client.query("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  await client.end();
  const env = { ...process.env, DATABASE_URL: E2E_DATABASE_URL, APP_STAGE: "preview", STORAGE_DRIVER: "database", SEED_SAMPLE_DATA: "true" };
  execSync("npx tsx scripts/migrate.ts", { env, stdio: "inherit" });
  execSync("npx tsx --conditions=react-server scripts/seed.ts", { env, stdio: "inherit" });
  execSync("npx tsx --conditions=react-server scripts/seed-sample.ts", { env, stdio: "inherit" });
  execSync("npx tsx --conditions=react-server scripts/admin.ts create", { env: { ...env, ADMIN_EMAIL: ADMIN.email, ADMIN_NAME: "E2E Owner", ADMIN_PASSWORD: ADMIN.password }, stdio: "inherit" });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
