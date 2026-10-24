import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://swastik:swastik@localhost:5432/swastik_dev" },
  casing: "snake_case",
  strict: true,
});
