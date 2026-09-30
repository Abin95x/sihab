import "server-only";
import { lt, sql } from "drizzle-orm";
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
 * Counts one attempt against `key` before it is made, atomically. Up to `maxFailures` attempts are allowed
 * within a `lockSeconds` window from the first; the one that reaches `maxFailures` locks the key for
 * `lockSeconds`, and each refused attempt after that restarts the lock. Call reset() after a success.
 */
export async function recordAttempt(
  key: string,
  { maxFailures, lockSeconds }: Lockout,
): Promise<{ allowed: boolean; attemptsLeft: number; lockedForSeconds: number }> {
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
  const attemptsLeft = Math.max(0, maxFailures - row.count);
  return {
    allowed: row.count <= maxFailures,
    attemptsLeft,
    lockedForSeconds: attemptsLeft === 0 ? Math.max(1, Number(row.retryAfter)) : 0,
  };
}

export async function reset(key: string) {
  await getDb().delete(rateLimits).where(sql`${rateLimits.key} = ${key}`);
}
