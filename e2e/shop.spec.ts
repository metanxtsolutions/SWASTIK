import { expect, test } from "@playwright/test";

test.describe("guest shopping", () => {
  test("home page lets customers start shopping and is marked as a preview", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/Preview site/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Shop flowers/ }).first()).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("search finds flowers and shows an empty state for unknown terms", async ({ page }) => {
    await page.goto("/search?q=lotus");
    await expect(page.getByRole("link", { name: "Lotus Flower" }).first()).toBeVisible();
    await page.goto("/search?q=zzzzzz");
    await expect(page.getByText("No flowers found")).toBeVisible();
  });

  test("checks delivery for a PIN code", async ({ page }) => {
    await page.goto("/delivery");
    await page.getByPlaceholder("Enter PIN code").first().fill("700001");
    await page.getByRole("button", { name: "Check", exact: true }).first().click();
    await expect(page.getByText(/do not deliver to 700001/)).toBeVisible();
    await page.getByPlaceholder("Enter PIN code").first().fill("712248");
    await page.getByRole("button", { name: "Check", exact: true }).first().click();
    await expect(page.getByText("We deliver to 712248", { exact: false }).first()).toBeVisible();
  });

  test("adds to cart, checks out as a guest and pays in test mode", async ({ page }) => {
    await page.goto("/product/marigold-flowers-loose");
    await expect(page.getByText("per 250 g pack").first()).toBeVisible();
    await page.getByText("500 g", { exact: true }).first().click();
    // The sample delivery area has a ₹100 minimum order: 2 × ₹75.
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await page.getByRole("button", { name: /Add to cart/ }).click();
    await expect(page.getByText(/added to cart/)).toBeVisible();

    await page.goto("/cart");
    await expect(page.getByRole("link", { name: "Marigold Flowers, Loose" })).toBeVisible();
    await page.getByLabel("Delivery PIN code").fill("712248");
    await page.locator("form", { has: page.locator("#cart-pin") }).getByRole("button").click();
    await expect(page.getByText(/Delivering to 712248/)).toBeVisible();
    await page.getByRole("link", { name: /Checkout/ }).click();

    await page.getByLabel("Full name").fill("E2E Customer");
    await page.getByLabel("Mobile number").fill("9876543210");
    await page.getByLabel("House or flat number, building and street").fill("1 Test Lane");
    await page.getByLabel("Locality or area").fill("Rishra");
    await expect(page.getByRole("radiogroup", { name: "Delivery date" })).toBeVisible();
    await page.getByRole("button", { name: /^Pay / }).click();

    await page.waitForURL(/\/pay\/test\//);
    await expect(page.getByText(/Test mode/)).toBeVisible();
    await page.getByRole("button", { name: "Simulate successful payment" }).click();
    await page.waitForURL(/\/order\/SW-/);
    await expect(page.getByRole("heading", { name: /Payment received/ })).toBeVisible();
    await expect(page.getByText("1 Test Lane")).toBeVisible();

    // The cart is emptied once the order exists.
    await page.goto("/cart");
    await expect(page.getByText("Your cart is empty")).toBeVisible();
  });

  test("a failed test payment leaves the order waiting for payment", async ({ page }) => {
    await page.goto("/product/lotus-flower");
    for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Increase quantity" }).click();
    await page.getByRole("button", { name: /Buy now/ }).click();
    await page.waitForURL(/\/checkout/);
    await page.getByLabel("PIN code", { exact: true }).fill("712248");
    await page.getByLabel("Full name").fill("E2E Two");
    await page.getByLabel("Mobile number").fill("9123456789");
    await page.getByLabel("House or flat number, building and street").fill("2 Test Lane");
    await page.getByLabel("Locality or area").fill("Rishra");
    await expect(page.getByRole("radiogroup", { name: "Delivery date" })).toBeVisible();
    await page.getByRole("button", { name: /^Pay / }).click();
    await page.waitForURL(/\/pay\/test\//);
    await page.getByRole("button", { name: "Simulate failed payment" }).click();
    await page.waitForURL(/\/order\/SW-/);
    await expect(page.getByRole("heading", { name: "Payment not completed" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Pay / })).toBeVisible();
  });

  test("an order page without its token is not found", async ({ page }) => {
    const res = await page.goto("/order/SW-ABCDEFGH");
    expect(res?.status()).toBe(404);
    expect((await page.goto("/product/no-such-flower"))?.status()).toBe(404);
  });

  test("blocks checkout below the minimum order", async ({ page }) => {
    await page.goto("/product/red-hibiscus-jaba");
    await page.getByRole("button", { name: /Buy now/ }).click();
    await page.waitForURL(/\/checkout/);
    await page.getByLabel("PIN code", { exact: true }).fill("712248");
    await expect(page.getByText(/minimum order for Rishra is ₹100\. Add a little more/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Pay / })).toBeDisabled();
  });

  test("sends a bulk enquiry with several flowers", async ({ page }) => {
    await page.goto("/bulk-orders");
    await page.getByLabel("Mandir, institution or customer name").fill("E2E Mandir");
    await page.getByLabel("Contact person").fill("Pujari Ji");
    await page.locator("#b-phone").fill("9830012345");
    await page.getByLabel("Delivery address").fill("Temple Road, Rishra");
    await page.locator("#b-pin").fill("712248");
    await page.locator('input[id^="b-f-"]').first().fill("Marigold");
    await page.locator('input[id^="b-q-"]').first().fill("20");
    await page.getByRole("button", { name: "Add another variety" }).click();
    await page.locator('input[id^="b-f-"]').nth(1).fill("Lotus");
    await page.locator('input[id^="b-q-"]').nth(1).fill("108");
    await page.locator('select[id^="b-u-"]').nth(1).selectOption("pieces");
    const d = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    await page.getByLabel("Required delivery date").fill(d);
    await page.waitForTimeout(3100); // the form refuses instant (bot-like) submissions
    await page.getByRole("button", { name: "Request a bulk quote" }).click();
    await expect(page.getByText("Enquiry received")).toBeVisible();
    await expect(page.getByText(/BQ-[A-Z0-9]{6}/)).toBeVisible();
  });
});

test.describe("security basics", () => {
  test("admin pages need a sign-in", async ({ page }) => {
    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/admin\/login/);
    const res = await page.request.get("/admin/orders/export");
    expect([401, 307, 302, 200]).toContain(res.status());
    if (res.status() === 200) expect(await res.text()).not.toContain("Order,Placed");
  });

  test("checkout refuses cross-site requests", async ({ request }) => {
    const res = await request.post("/api/checkout", { data: {}, headers: { Origin: "https://evil.example" } });
    expect(res.status()).toBe(400);
  });

  test("forged payment webhooks are rejected", async ({ request }) => {
    const res = await request.post("/api/payments/webhook/test", { data: JSON.stringify({ id: "x", type: "payment.captured", order_id: "o", amount: 1 }), headers: { "x-test-signature": "bad", "content-type": "application/json" } });
    expect(res.status()).toBe(401);
  });

  test("robots and sitemap are served", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /");
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain("/product/marigold-flowers-loose");
  });
});
