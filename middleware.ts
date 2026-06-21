import { NextRequest, NextResponse } from "next/server";

// Gates the whole app behind a single shared password. A successful login sets
// the `wright_auth` cookie to SESSION_SECRET; here we just check it matches.
const AUTH_COOKIE = "wright_auth";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow the login screen and the login endpoint through.
  if (pathname === "/login" || pathname === "/api/login") {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const expected = process.env.SESSION_SECRET;
  if (expected && token === expected) {
    return NextResponse.next();
  }

  // API calls get a clean 401; page loads get redirected to the login screen.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals and static asset files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
