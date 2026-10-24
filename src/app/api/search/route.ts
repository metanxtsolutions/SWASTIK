import { NextResponse } from "next/server";
import { getDb } from "@/server/db/client";
import { errorResponse } from "@/server/http";
import { listProducts } from "@/server/services/catalog";

export async function GET(req: Request) {
  try {
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
    if (q.length < 2) return NextResponse.json({ items: [] });
    const { items } = await listProducts(getDb(), { q, limit: 6 });
    return NextResponse.json(
      { items: items.map((p) => ({ slug: p.slug, name: p.name, pricePaise: p.pricePaise, unitText: p.unitText })) },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
