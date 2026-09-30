import "server-only";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { getDb } from "./db";
import { rateLimits } from "./db/schema";

// Fixed-window rate limiter stored in Postgres, so the count is shared by every server instance
// (serverless functions don't share memory). One upsert per call.

export type Limit = { limit: number; windowSeconds: number };
export type LimitResult = { allowed: boolean; retryAfterSeconds: number };

/** Counts one hit against `key` and reports whether it is within the limit. */
export async function consume(key: string, { limit, windowSeconds }: Limit): Promise<LimitResult> {
  const db = getDb();
  const window = sql`make_interval(secs => ${windowSeconds})`;
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, resetAt: sql`now() + ${window}` })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.resetAt} <= now() then 1 else ${rateLimits.count} + 1 end`,
        resetAt: sql`case when ${rateLimits.resetAt} <= now() then now() + ${window} else ${rateLimits.resetAt} end`,
      },
    })
    .returning({
      count: rateLimits.count,
      retryAfter: sql<number>`ceil(extract(epoch from ${rateLimits.resetAt} - now()))::int`,
    });

  // Expired rows are only reset lazily, so sweep them out now and then.
  if (Math.random() < 0.02) {
    db.delete(rateLimits)
      .where(lt(rateLimits.resetAt, sql`now()`))
      .catch((error) => console.error("[sihab] Failed to sweep rate limits", error));
  }

  return { allowed: row.count <= limit, retryAfterSeconds: Math.max(1, Number(row.retryAfter)) };
}

export type Lockout = { maxFailures: number; lockSeconds: number };

/**
 * Seconds left on `key`'s lockout, or 0 if it isn't locked. A key is locked once it has `maxFailures`
 * failures recorded by recordFailure(), until the lock expires.
 */
export async function lockedFor(key: string, { maxFailures }: Lockout): Promise<number> {
  const [row] = await getDb()
    .select({
      count: rateLimits.count,
      retryAfter: sql<number>`ceil(extract(epoch from ${rateLimits.resetAt} - now()))::int`,
    })
    .from(rateLimits)
    .where(and(eq(rateLimits.key, key), gt(rateLimits.resetAt, sql`now()`)))
    .limit(1);
  return row && row.count >= maxFailures ? Math.max(1, Number(row.retryAfter)) : 0;
}

/**
 * Records one failure against `key`. Failures count within a `lockSeconds` window from the first one; the
 * failure that reaches `maxFailures` locks the key for `lockSeconds` from that moment.
 */
export async function recordFailure(
  key: string,
  { maxFailures, lockSeconds }: Lockout,
): Promise<{ failuresLeft: number; lockedForSeconds: number }> {
  const lock = sql`now() + make_interval(secs => ${lockSeconds})`;
  const expired = sql`${rateLimits.resetAt} <= now()`;
  const [row] = await getDb()
    .insert(rateLimits)
    .values({ key, count: 1, resetAt: lock })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimits.count} + 1 end`,
        resetAt: sql`case when ${expired} or ${rateLimits.count} + 1 >= ${maxFailures} then ${lock} else ${rateLimits.resetAt} end`,
      },
    })
    .returning({
      count: rateLimits.count,
      retryAfter: sql<number>`ceil(extract(epoch from ${rateLimits.resetAt} - now()))::int`,
    });
  const locked = row.count >= maxFailures;
  return {
    failuresLeft: Math.max(0, maxFailures - row.count),
    lockedForSeconds: locked ? Math.max(1, Number(row.retryAfter)) : 0,
  };
}

export async function reset(key: string) {
  await getDb().delete(rateLimits).where(sql`${rateLimits.key} = ${key}`);
}
