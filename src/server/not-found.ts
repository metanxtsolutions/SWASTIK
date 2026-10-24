import "server-only";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getDb } from "./db/client";
import { findRedirect } from "./services/content";

/** For a missing product, category or guide: follow a redirect the owner set up, otherwise 404. */
export async function notFoundOrRedirect(path: string): Promise<never> {
  const r = await findRedirect(getDb(), path);
  if (r) {
    if (r.permanent) permanentRedirect(r.toPath);
    redirect(r.toPath);
  }
  notFound();
}
