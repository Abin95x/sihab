import "server-only";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb, isDbConfigured } from "./db";
import { admins } from "./db/schema";
import { isUuid } from "./photos";

export const SESSION_COOKIE = "sihab_admin";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

/** Login needs the signing secret and the database that holds the admin accounts. */
export function isAdminConfigured() {
  return Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32 && isDbConfigured());
}

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

// Changes whenever the admin's password changes, which invalidates their existing sessions.
function sessionVersion(passwordHash: string) {
  return createHash("sha256").update(passwordHash).digest("base64url").slice(0, 16);
}

export async function createSession(admin: { id: string; passwordHash: string }) {
  const token = await new SignJWT({ role: "admin", v: sessionVersion(admin.passwordHash) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(admin.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(secretKey());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export type Session = { id: string; username: string };

/**
 * Checks a session cookie: signature, expiry, and that the admin still exists with the same password.
 * Also used by src/proxy.ts, which reads the cookie from the request instead of next/headers.
 */
export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token || !isAdminConfigured()) return null;
  let adminId: string;
  let version: string;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (payload.role !== "admin" || typeof payload.v !== "string" || !isUuid(payload.sub)) return null;
    adminId = payload.sub;
    version = payload.v;
  } catch {
    return null;
  }
  try {
    const [admin] = await getDb()
      .select({ id: admins.id, username: admins.username, passwordHash: admins.passwordHash })
      .from(admins)
      .where(eq(admins.id, adminId))
      .limit(1);
    if (!admin || sessionVersion(admin.passwordHash) !== version) return null;
    return { id: admin.id, username: admin.username };
  } catch (error) {
    console.error("[sihab] Failed to check the admin session", error);
    return null;
  }
}

/** The signed-in admin, or null. Cached per request, so several checks cost one query. */
export const getSession = cache(async () => verifySession((await cookies()).get(SESSION_COOKIE)?.value));

/** Use at the top of every admin page and Server Action. */
export async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return session;
}
