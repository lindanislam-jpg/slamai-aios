import { NextResponse, type NextRequest } from "next/server";

/** Cheap gate: no session cookie → sign-in page. The session itself is
 *  validated against the database in the app layout and every API route. */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/health") || pathname.startsWith("/_next") || pathname === "/favicon.ico") return NextResponse.next();
  if (!req.cookies.get("asgard_session")) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
