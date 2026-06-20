// middleware.ts
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/", "/login", "/register", "/about"];

// Set this to your backend origin, for example:
// https://clearpath.api.wahb.space
const AUTH_API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL;

function isPublicRoute(pathname) {
  return PUBLIC_ROUTES.includes(pathname);
}

function shouldSkipMiddleware(pathname) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.(svg|png|jpg|jpeg|ico|css|js|map)$/.test(pathname)
  );
}

async function verifyAuth(req) {
  const cookieHeader = req.headers.get("cookie") ?? "";

  const res = await fetch(`${AUTH_API_BASE}/auth/verify`, {
    method: "GET",
    headers: {
      cookie: cookieHeader,
    },
    cache: "no-store",
  });

  return res.ok;
}

export async function proxy(req) {
  const { pathname } = req.nextUrl;

  if (shouldSkipMiddleware(pathname) || isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  try {
    const valid = await verifyAuth(req);

    if (valid) {
      return NextResponse.next();
    }

    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  } catch {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};