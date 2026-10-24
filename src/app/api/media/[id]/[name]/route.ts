import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { media } from "@/server/db/schema";
import { getObject } from "@/server/storage";

/** Public catalogue images. The id is random; the name part is only for descriptive URLs. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; name: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const [row] = await getDb().select().from(media).where(eq(media.id, id));
  if (!row) return new Response("Not found", { status: 404 });
  try {
    const body = await getObject(row.storageKey);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": row.contentType,
        "Content-Length": String(body.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `inline; filename="${row.filename.replace(/[^\w.-]/g, "_")}"`,
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
