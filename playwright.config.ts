import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;
const env = {
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgres://swastik:swastik@localhost:5432/swastik_e2e",
  APP_URL: `http://localhost:${PORT}`,
  APP_STAGE: "preview",
  AUTH_SECRET: "e2e-only-auth-secret-0123456789abcdefghijkl",
  PAYMENT_GATEWAY: "mock",
  STORAGE_DRIVER: "database",
  EMAIL_DRIVER: "outbox",
  NEXT_DIST_DIR: ".next-e2e",
  SEED_SAMPLE_DATA: "true",
};

/**
 * End-to-end tests run against a production build on port 3200 with its own
 * database (swastik_e2e), so they never touch development data. The server
 * command resets that database (e2e/prepare.ts) before building.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: env.APP_URL, trace: "retain-on-failure", launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {} },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], browserName: "chromium" } },
    { name: "desktop", use: { viewport: { width: 1366, height: 900 }, browserName: "chromium" } },
  ],
  webServer: {
    command: `npx tsx e2e/prepare.ts && npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 300_000,
    reuseExistingServer: false,
    env,
  },
});
