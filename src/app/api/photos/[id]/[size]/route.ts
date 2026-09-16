import { eq } from "drizzle-orm";
import { getDb, isDbConfigured } from "@/lib/db";
import { photos } from "@/lib/db/schema";
import { isUuid } from "@/lib/photos";

export async function GET(_request: Request, ctx: RouteContext<"/api/photos/[id]/[size]">) {
  const { id, size } = await ctx.params;
  if (!isUuid(id) || (size !== "thumb" && size !== "full") || !isDbConfigured()) {
    return new Response("Not found", { status: 404 });
  }

  const [row] = await getDb()
    .select({ body: size === "thumb" ? photos.thumb : photos.data, mime: photos.mime })
    .from(photos)
    .where(eq(photos.id, id))
    .limit(1);

  if (!row) return new Response("Not found", { status: 404 });

  // Photos are never modified after upload, so a given id can be cached forever.
  return new Response(new Uint8Array(row.body), {
    headers: {
      "Content-Type": row.mime,
      "Content-Length": String(row.body.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
