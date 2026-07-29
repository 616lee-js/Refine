import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/api/auth/login",
  "/api/auth/signup",
  // Vercel Cron sends no session cookie. The matcher below catches everything,
  // so without this the daily keep-alive would be redirected to /login, never
  // reach Postgres, and let the Supabase project pause while reporting success.
  // The route authenticates itself with CRON_SECRET.
  "/api/health",
];

// Middleware runs in the edge runtime — no Node.js crypto allowed.
// Coarse check: cookie present → let through. Route handlers call getSession()
// for full iron-session verification and userId check.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!req.cookies.get("refine_session")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
