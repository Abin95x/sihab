import { getHomePhotos, getStories } from "@/lib/data";
import { clientIp, hitMemoryLimit } from "@/lib/memory-rate-limit";
import { isSection } from "@/lib/photos";
import { readSearch } from "@/lib/validation";

/**
 * The next slice of a public list, for infinite scroll: `?list=home|editorial|commercial&offset=12`.
 * Editorial and commercial also take `q`, the search the list is filtered by.
 * Pages render their first slice on the server; the browser fetches the rest from here as the visitor scrolls.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const list = searchParams.get("list");
  const offset = Number(searchParams.get("offset"));
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100_000) {
    return Response.json({ error: "Invalid offset." }, { status: 400 });
  }

  if (list === "home") return Response.json(await getHomePhotos(offset));
  if (isSection(list)) {
    const search = readSearch(searchParams.get("q"));
    // Searches bypass the data cache, so cap how often one client can run them (src/proxy.ts skips /api).
    if (search) {
      const limit = hitMemoryLimit(`search:${clientIp(request.headers)}`, 120, 60_000);
      if (!limit.allowed) {
        return Response.json(
          { error: "Too many requests." },
          { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
        );
      }
    }
    return Response.json(await getStories(list, offset, search));
  }
  return Response.json({ error: "Unknown list." }, { status: 400 });
}
