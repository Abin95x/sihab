import { getHomePhotos, getStories } from "@/lib/data";
import { clientIp, hitMemoryLimit } from "@/lib/memory-rate-limit";
import { isSection } from "@/lib/photos";
import { readSearch } from "@/lib/validation";

/**
 * The next slice of a public list, for infinite scroll: `?list=home|editorial|commercial&offset=12`.
 * Editorial and commercial also take `q`, the search the list is filtered by.
 * Pages render their first slice on the server; the browser fetches the rest from here as the visitor scrolls.
 */
// src/proxy.ts skips /api, so this route limits its own callers. Real scrolling needs a request every few
// seconds at most; searches bypass the data cache, so they get a tighter budget.
const PER_MINUTE = { list: 120, search: 60 };

function tooManyRequests(retryAfterSeconds: number) {
  return Response.json(
    { error: "Too many requests." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

export async function GET(request: Request) {
  const ip = clientIp(request.headers);
  const listLimit = hitMemoryLimit(`more:${ip}`, PER_MINUTE.list, 60_000);
  if (!listLimit.allowed) return tooManyRequests(listLimit.retryAfterSeconds);

  const { searchParams } = new URL(request.url);
  const list = searchParams.get("list");
  const offset = Number(searchParams.get("offset"));
  // Finer checks (page alignment, a lower cap) happen in getHomePhotos() / getStories().
  if (!Number.isSafeInteger(offset) || offset < 0) {
    return Response.json({ error: "Invalid offset." }, { status: 400 });
  }

  if (list === "home") return Response.json(await getHomePhotos(offset));
  if (isSection(list)) {
    const search = readSearch(searchParams.get("q"));
    if (search) {
      const searchLimit = hitMemoryLimit(`search:${ip}`, PER_MINUTE.search, 60_000);
      if (!searchLimit.allowed) return tooManyRequests(searchLimit.retryAfterSeconds);
    }
    return Response.json(await getStories(list, offset, search));
  }
  return Response.json({ error: "Unknown list." }, { status: 400 });
}
