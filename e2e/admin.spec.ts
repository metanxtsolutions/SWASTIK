import { expect, test } from "@playwright/test";
import { ADMIN } from "./constants";

test.describe("sign-in", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("keeps the email after a wrong password, then signs in", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(ADMIN.email);
    await page.getByLabel("Password").fill("wrong password value");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("The email or password is incorrect.")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue(ADMIN.email);
    await page.getByLabel("Password").fill(ADMIN.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  });
});

test.describe("master admin", () => {
  test("sees the bulk enquiry and manages an order", async ({ page }) => {
    await page.goto("/admin/bulk-enquiries");
    // The shopping tests send one enquiry from the phone run and one from the desktop run.
    await expect(page.getByRole("link", { name: "E2E Mandir" })).toHaveCount(2);
    await page.getByRole("link", { name: "E2E Mandir" }).first().click();
    await expect(page.getByRole("cell", { name: "Lotus" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "108 pieces" })).toBeVisible();

    await page.goto("/admin/orders?status=pending_confirmation");
    await page.locator("table a").first().click();
    await page.getByRole("button", { name: "Update status" }).click();
    await expect(page.getByText(/Order moved to Confirmed/)).toBeVisible();

    const csv = await page.request.get("/admin/orders/export");
    expect(csv.status()).toBe(200);
    expect(await csv.text()).toContain("E2E Customer");
  });

  test("edits a product price and the shop shows it", async ({ page }) => {
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

test.describe("master admin settings and content", () => {
  test("uploads a product photo", async ({ page }) => {
    const sharp = (await import("sharp")).default;
    const png = await sharp({ create: { width: 640, height: 640, channels: 3, background: "#f4a020" } }).png().toBuffer();
    await page.goto("/admin/products?q=bel");
    await page.getByRole("link", { name: /Bel Patra/ }).click();
    await page.locator('input[name="images"]').setInputFiles({ name: "bel-leaves.png", mimeType: "image/png", buffer: png });
    await page.getByPlaceholder(/e.g. Fresh/).fill("Fresh bel leaves tied in a bundle");
    await page.getByRole("button", { name: "Upload" }).click();
    await expect(page.getByText("Photos uploaded.")).toBeVisible();
    // A non-image file is refused, whatever its name says.
    await page.locator('input[name="images"]').setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("<svg onload=alert(1)>") });
    await page.getByRole("button", { name: "Upload" }).click();
    await expect(page.getByText("Only JPEG, PNG or WebP images are accepted")).toBeVisible();
    await page.goto("/product/bel-patra-bilva-leaves");
    await page.getByRole("button", { name: "Show photo 2" }).click();
    await expect(page.getByRole("img", { name: "Fresh bel leaves tied in a bundle" })).toBeVisible();
  });

  test("saves business details and shows them on the site", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.getByLabel("WhatsApp number").fill("919800000001");
    await page.getByLabel("Business hours (optional)").fill("Every day, 5 am to 8 pm");
    await page.getByRole("button", { name: "Save business details" }).click();
    await expect(page.getByText("Business details saved.")).toBeVisible();
    await page.goto("/contact");
    await expect(page.getByText("Every day, 5 am to 8 pm").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /WhatsApp 919800000001/ }).first()).toHaveAttribute("href", /wa\.me\/919800000001/);
  });

  test("creates a promo code that the cart applies", async ({ page }) => {
    await page.goto("/admin/coupons");
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Create code" }) });
    await form.getByLabel("Code", { exact: true }).fill("E2ETEN");
    await form.getByLabel("Percent (for percentage)").fill("10");
    await form.getByRole("button", { name: "Create code" }).click();
    await expect(page.getByText("Promo code saved.")).toBeVisible();
    await page.goto("/product/mixed-flower-bundle");
    await page.getByRole("button", { name: /Add to cart/ }).click();
    await page.goto("/cart");
    await page.getByLabel("Promo code").fill("e2eten");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("E2ETEN applied")).toBeVisible();
    await expect(page.getByText("-₹15")).toBeVisible();
  });

  test("adds a delivery area with a time slot", async ({ page }) => {
    await page.goto("/admin/delivery");
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Create delivery area" }) });
    await form.getByLabel("Area name").fill("Konnagar");
    await form.getByLabel("PIN codes served").fill("712235, Konnagar");
    await form.getByLabel("Delivery charge (₹)").fill("40");
    await form.getByLabel("Active: accept orders for these PIN codes").check();
    await form.getByRole("button", { name: "Create delivery area" }).click();
    await expect(page.getByRole("heading", { name: "Konnagar" })).toBeVisible();
    const slot = page.locator("form").filter({ has: page.getByRole("button", { name: "Add slot" }) });
    await slot.getByLabel("Starts").fill("07:00");
    await slot.getByLabel("Ends").fill("09:00");
    await slot.getByRole("button", { name: "Add slot" }).click();
    await expect(page.getByText("Time slot saved.")).toBeVisible();
    await page.goto("/delivery");
    await expect(page.getByRole("heading", { name: "Konnagar" })).toBeVisible();
    await expect(page.getByText("712235 (Konnagar)")).toBeVisible();
  });
});
