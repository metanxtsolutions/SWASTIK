import "server-only";
import { cache } from "react";
import { getDb } from "./db/client";
import { getEnv, isNonProduction } from "./env";
import { listCategories } from "./services/catalog";
import { footerPages } from "./services/content";
import { getAllSettings } from "./services/settings";
import { gateway } from "./payments";

/** Data shared by every storefront page, loaded once per request or render. */
export const siteData = cache(async () => {
  const db = getDb();
  const [settings, categories, pages] = await Promise.all([getAllSettings(db), listCategories(db), footerPages(db)]);
  const env = getEnv();
  return {
    settings,
    categories,
    footerPages: pages,
    stage: env.APP_STAGE,
    nonProduction: isNonProduction(env),
    testPayments: gateway()?.isTest ?? false,
    appUrl: env.APP_URL,
  };
});

export type SiteData = Awaited<ReturnType<typeof siteData>>;

export function absoluteUrl(path: string): string {
  return new URL(path, getEnv().APP_URL).toString();
}
