// Per-instance, in-memory burst limiter used by src/proxy.ts. It needs no database round trip, so it
// sheds floods cheaply before they reach a page or Server Action. Limits that must hold across
// instances (login) use the database limiter in rate-limit.ts.

const MAX_KEYS = 10_000;
const hits = new Map<string, { count: number; resetAt: number }>();

export function hitMemoryLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  let entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    if (hits.size >= MAX_KEYS) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      // Still full of live entries: drop the oldest rather than grow without bound.
      if (hits.size >= MAX_KEYS) hits.delete(hits.keys().next().value!);
    }
    entry = { count: 0, resetAt: now + windowMs };
    hits.set(key, entry);
  }
  entry.count += 1;
  return { allowed: entry.count <= limit, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
}

/**
 * The client's IP address. Trusts the proxy headers set by the host (Vercel and most platforms
 * overwrite them). If the app is exposed directly, these headers are client-controlled, which is
 * why login is also limited per username.
 */
export function clientIp(headers: Headers) {
  return (
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  ).slice(0, 64);
}
