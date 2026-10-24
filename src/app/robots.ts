import type { MetadataRoute } from "next";
import { getEnv, isNonProduction } from "@/server/env";

export default function robots(): MetadataRoute.Robots {
  const env = getEnv();
  // Previews and development copies must not be indexed alongside the real site.
  if (isNonProduction(env)) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/cart", "/checkout", "/order/", "/track", "/pay/", "/search"],
      },
    ],
    sitemap: `${env.APP_URL}/sitemap.xml`,
    host: env.APP_URL,
  };
}
