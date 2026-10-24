import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ADMIN = ["/admin/login", "/admin/setup", "/admin/forgot-password", "/admin/reset-password"];

/**
 * Cheap edge check: visitors without an admin session cookie are sent to the
 * login page. The real session check happens on the server for every admin page
 * and every admin action.
 */
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (PUBLIC_ADMIN.some((p) => path === p || path.startsWith(`${p}/`))) return NextResponse.next();
  if (!req.cookies.get("__Host-swastik_admin") && !req.cookies.get("swastik_admin")) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
