// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_ROUTES = ['/', '/login', '/register', '/about'];

function isPublicRoute(pathname) {
  return PUBLIC_ROUTES.includes(pathname);
}

function shouldSkipMiddleware(pathname) {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    /\.(svg|png|jpg|jpeg|ico|css|js|map)$/.test(pathname)
  );
}

export function proxy(req) {
  const { pathname } = req.nextUrl;

  if (shouldSkipMiddleware(pathname) || isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  const accessToken = req.cookies.get('accessToken')?.value;
  const refreshToken = req.cookies.get('refreshToken')?.value;

  if (!accessToken && !refreshToken) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
};