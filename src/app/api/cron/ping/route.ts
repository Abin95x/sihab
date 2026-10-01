import { timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

/**
 * Runs a trivial query once a day so the free Supabase project isn't paused for inactivity.
 * Called by Vercel Cron (see vercel.json), which sends `Authorization: Bearer $CRON_SECRET`.
 */
function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  // Without a secret anyone could hit the database through this route, so refuse instead.
  if (!secret) return false;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Database ping failed:", error);
    return Response.json({ error: "Database ping failed." }, { status: 500 });
  }
}
