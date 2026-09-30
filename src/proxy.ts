import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { clientIp, hitMemoryLimit } from "@/lib/memory-rate-limit";

const isDev = process.env.NODE_ENV === "development";

// Photos are served straight from the storage bucket, so its origin must be allowed as an image source.
const photosOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_PHOTOS_URL ?? "").origin;
  } catch {
    return "";
  }
})();

/**
 * A strict, nonce-based Content Security Policy: only scripts carrying this request's nonce (which
 * Next.js adds to its own scripts) may run, so injected markup can't execute. Every page is rendered
 * per request (see the root layout), which nonces require.
 */
function contentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    // React needs eval in development only, for its debugging features.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes (e.g. the spinner's size) can't carry a nonce; styles can't run code.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${photosOrigin}`.trim(),
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

// Per-IP request budgets per minute. Generous for people, low enough to blunt floods and scripted guessing.
const LIMITS = {
  page: 300,
  action: 300,
  login: 20,
} as const;

function tooManyRequests(retryAfterSeconds: number) {
  return new NextResponse("Too many requests. Try again shortly.", {
    status: 429,
    headers: { "Retry-After": String(retryAfterSeconds), "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const onLogin = pathname === "/admin/login";
  const isAction = request.method === "POST" && request.headers.has("next-action");

  const bucket = isAction ? (onLogin ? "login" : "action") : "page";
  const limit = hitMemoryLimit(`${bucket}:${clientIp(request.headers)}`, LIMITS[bucket], 60_000);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  // Admin redirects happen here rather than with redirect() inside the pages: a page that
  // redirects while rendering trips a React dev-mode bug ("cannot have a negative time stamp",
  // react/react#37561). Pages and Server Actions still call requireAdmin() themselves.
  // Server Actions are let through so they can return their own result.
  if (isAdmin && !isAction) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const session = await verifySession(token);
    if (session && onLogin) return NextResponse.redirect(new URL("/admin", request.url));
    if (!session && !onLogin) {
      const response = NextResponse.redirect(new URL("/admin/login", request.url));
      // Clear a cookie that is expired, forged or from before a password change.
      if (token) response.cookies.delete(SESSION_COOKIE);
      return response;
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (isAdmin) {
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  // Everything except build assets, the photo redirect route and static files such as /demo/*.jpg.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
