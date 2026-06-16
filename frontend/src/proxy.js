import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, createRemoteJWKSet } from 'jose';

const PUBLIC_ROUTES = ['/', '/login', '/register','/about'];
const PUBLIC_API_PREFIXES = ['/api/auth'];

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

const JWKS = createRemoteJWKSet(
  new URL(`${BACKEND_URL}/auth/.well-known/jwks.json`)
);

function isPublicRoute(pathname) {
  if (pathname === '/') return true;

  return PUBLIC_ROUTES.slice(1).some((route) => pathname === route);
}

function isPublicApiRoute(pathname) {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function shouldSkipMiddleware(pathname) {
  return (pathname.startsWith('/_next') ||
  pathname.startsWith('/favicon') || pathname.match(/\.(svg|png|jpg|jpeg|ico|css|js|map)$/));
}

const cookieBaseOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
};

export function proxy(req) {
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.startsWith('/api/auth');

  if (isPublic) return NextResponse.next();

  const accessToken = req.cookies.get('accessToken')?.value;
  const refreshToken = req.cookies.get('refreshToken')?.value;
  const sid = req.cookies.get('sid')?.value;

  if (!accessToken && !refreshToken) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};