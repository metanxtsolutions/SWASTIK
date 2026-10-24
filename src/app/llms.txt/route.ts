import { getDb } from "@/server/db/client";
import { getEnv } from "@/server/env";
import { listCategories } from "@/server/services/catalog";
import { listArticles } from "@/server/services/content";
import { listActiveZones } from "@/server/services/delivery";
import { getAllSettings } from "@/server/services/settings";

export const revalidate = 3600;

/**
 * llms.txt: an optional plain-text summary for AI assistants that look for it.
 * It mirrors what the public pages already say; it is not a ranking signal.
 */
export async function GET() {
  const db = getDb();
  const env = getEnv();
  const [{ business, seo }, categories, zones, guides] = await Promise.all([getAllSettings(db, ["business", "seo"]), listCategories(db), listActiveZones(db), listArticles(db, { limit: 20 })]);
  const url = (p: string) => new URL(p, env.APP_URL).toString();
  const lines = [
    `# ${business.name}`,
    "",
    `> ${seo.defaultDescription}`,
    "",
    `${business.name} sells puja flowers, garlands, puja leaves and daily puja flower packs online, based in ${[business.locality, business.district, business.state].filter(Boolean).join(", ")}, India. Customers order as guests (no account), choose a delivery date and slot, and pay at checkout. Mandirs and other large buyers request quotations through the bulk order form.`,
    "",
    "## Shop",
    `- [All flowers](${url("/shop")})`,
    ...categories.map((c) => `- [${c.name}](${url(`/category/${c.slug}`)})${c.summary ? `: ${c.summary}` : ""}`),
    "",
    "## Ordering and delivery",
    `- [Delivery areas, charges and slots](${url("/delivery")})${zones.length ? `: currently ${zones.map((z) => `${z.name} (PIN ${z.pincodes.map((p) => p.pincode).join(", ")})`).join("; ")}` : ""}`,
    `- [Bulk orders for mandirs and events](${url("/bulk-orders")})`,
    `- [Questions and answers](${url("/faq")})`,
    `- [Contact](${url("/contact")})`,
    ...(guides.length ? ["", "## Guides", ...guides.map((g) => `- [${g.title}](${url(`/guides/${g.slug}`)})${g.excerpt ? `: ${g.excerpt}` : ""}`)] : []),
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
