import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = new Set(["/", "/login", "/signup", "/privacy", "/terms"]);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (!PUBLIC_PATHS.has(pathname) && !req.auth) {
    return Response.redirect(new URL("/login", req.nextUrl.origin));
  }
});

export const config = {
  // `.*\.\w+$` excludes any request for an actual static file (logo-icon.png,
  // robots.txt, the generated favicon route, etc.) — not just the specific
  // favicon.ico this used to special-case. Without this, a static asset
  // referenced by a *public* page (login/signup/landing) gets 302-redirected
  // to /login for logged-out visitors instead of served, which silently
  // breaks image rendering there rather than erroring loudly.
  matcher: ["/((?!api/auth|api/cron|_next/static|_next/image|.*\\.\\w+$).*)"],
};
