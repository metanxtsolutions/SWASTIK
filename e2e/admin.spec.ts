import { expect, test } from "@playwright/test";
import { ADMIN } from "./constants";

test.describe("master admin", () => {
  test.skip(({ isMobile }) => isMobile, "Admin flows are covered on desktop");

  test("signs in, sees the bulk enquiry and manages an order", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(ADMIN.email);
    await page.getByLabel("Password").fill("wrong password value");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("The email or password is incorrect.")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue(ADMIN.email);
    await page.getByLabel("Password").fill(ADMIN.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

    await page.goto("/admin/bulk-enquiries");
    await expect(page.getByRole("link", { name: "E2E Mandir" })).toBeVisible();
    await page.getByRole("link", { name: "E2E Mandir" }).click();
    await expect(page.getByText("Lotus")).toBeVisible();

    await page.goto("/admin/orders?status=pending_confirmation");
    await page.locator("table a").first().click();
    await page.getByRole("button", { name: "Update status" }).click();
    await expect(page.getByText(/Order moved to Confirmed/)).toBeVisible();

    const csv = await page.request.get("/admin/orders/export");
    expect(csv.status()).toBe(200);
    expect(await csv.text()).toContain("E2E Customer");
  });

  test("edits a product price and the shop shows it", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(ADMIN.email);
    await page.getByLabel("Password").fill(ADMIN.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await page.goto("/admin/products?q=rose petals");
    await page.getByRole("link", { name: /Rose Petals/ }).click();
    const price = page.getByText("Price (₹)", { exact: true }).locator("..").locator("input");
    await price.fill("55");
    await page.getByRole("button", { name: "Save product" }).click();
    await expect(page.getByText("Product saved.")).toBeVisible();
    await page.goto("/product/rose-petals");
    await expect(page.getByText("₹55").first()).toBeVisible();
  });
});
