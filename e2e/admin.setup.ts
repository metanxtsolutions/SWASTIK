import { expect, test as setup } from "@playwright/test";
import { ADMIN } from "./constants";

export const ADMIN_STATE = "e2e/.auth/admin.json";

// Sign in once and share the session: the sign-in rate limit (5 per email per 15 minutes) applies to tests too.
setup("sign in as the administrator", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await page.context().storageState({ path: ADMIN_STATE });
});
