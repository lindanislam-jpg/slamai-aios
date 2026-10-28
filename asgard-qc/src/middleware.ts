import { NextResponse, type NextRequest } from "next/server";

/** Cheap gate: no session cookie → sign-in page. The session itself is
 *  validated against the database in the app layout and every API route. */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  // A Vercel preview shares the production database unless one was isolated
  // for it; refuse to serve it so nobody can change live records from a preview.
  if (process.env.VERCEL_ENV === "preview" && process.env.PREVIEW_DB_ISOLATED !== "true") {
    return new NextResponse("This preview deployment is disabled: it has no separate database. Use the production site.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
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
