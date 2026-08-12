import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user?.role;

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (role !== "admin") {
      return Response.redirect(new URL("/admin/login", req.nextUrl.origin));
    }
    return;
  }

  if (pathname.startsWith("/portal") && pathname !== "/portal/login" && !req.auth) {
    return Response.redirect(new URL("/portal/login", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/portal/:path*", "/admin/:path*"],
};
