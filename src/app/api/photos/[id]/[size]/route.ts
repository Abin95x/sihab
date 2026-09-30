import { isUuid, photoUrl } from "@/lib/photos";

// Photo files are served straight from the storage bucket. This keeps old /api/photos links working.
export async function GET(_request: Request, ctx: RouteContext<"/api/photos/[id]/[size]">) {
  const { id, size } = await ctx.params;
  if (!isUuid(id) || (size !== "thumb" && size !== "full") || !process.env.NEXT_PUBLIC_PHOTOS_URL) {
    return new Response("Not found", { status: 404 });
  }
  return Response.redirect(photoUrl({ id, width: 0, height: 0 }, size), 308);
}
