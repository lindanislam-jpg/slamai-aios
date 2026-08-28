import { NextResponse, type NextRequest } from "next/server";

// Auth.js v5 cookie names (the __Secure- prefix is used over HTTPS).
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

/**
 * Cheap edge gate: bounce requests that carry no session cookie at all before
 * they reach the dashboard. The cookie is not verified here — decoding the JWT
 * would pull bcrypt/Prisma into the edge runtime — so the authoritative check
 * still lives in the (dashboard) layout and in every API route via `auth()`.
 *
 * Deliberately one-way: a request holding a stale or invalid cookie is allowed
 * through so the layout can reject it. Redirecting cookie-holders away from
 * /login here would bounce them between /login and /dashboard forever.
 */
export function middleware(req: NextRequest) {
  const hasSessionCookie = SESSION_COOKIES.some((name) => req.cookies.has(name));

  if (!hasSessionCookie) {
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/agents/:path*",
    "/crm/:path*",
    "/projects/:path*",
    "/marketing/:path*",
    "/documents/:path*",
    "/analytics/:path*",
    "/automation/:path*",
    "/marketplace/:path*",
    "/voice-ai/:path*",
    "/website/:path*",
    "/settings/:path*",
  ],
};
