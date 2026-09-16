import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// Admin redirects happen here rather than with redirect() inside the pages: a page that
// redirects while rendering trips a React dev-mode bug ("cannot have a negative time stamp",
// react/react#37561). Pages and Server Actions still call requireAdmin() themselves.
export async function proxy(request: NextRequest) {
  // Let Server Actions through so they can return their own result.
  if (request.headers.has("next-action")) return NextResponse.next();

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const onLogin = request.nextUrl.pathname === "/admin/login";

  if (session && onLogin) return NextResponse.redirect(new URL("/admin", request.url));
  if (!session && !onLogin) return NextResponse.redirect(new URL("/admin/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
