import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, createRemoteJWKSet } from 'jose';

// Routes that are accessible without a valid session
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/api/auth/login',
  '/api/auth/refresh',
];

// The backend URL to fetch the JWKS (public keys for RS256 verification)
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const JWKS = createRemoteJWKSet(new URL(`${BACKEND_URL}/auth/.well-known/jwks.json`));

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes without auth checks
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow Next.js internal requests and static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(svg|png|jpg|ico|css|js)$/)
  ) {
    return NextResponse.next();
  }

  const accessToken = req.cookies.get('access_token')?.value;
  const refreshToken = req.cookies.get('refresh_token')?.value;

  // No tokens at all — redirect to login
  if (!accessToken && !refreshToken) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Verify the access token
  if (accessToken) {
    try {
      await jwtVerify(accessToken, JWKS, { algorithms: ['RS256'] });
      // Token is valid — allow the request through
      return NextResponse.next();
    } catch {
      // Access token expired or invalid — try to refresh silently
    }
  }

  // Access token is missing or expired — attempt a silent token refresh
  if (refreshToken) {
    try {
      const sid = req.cookies.get('sid')?.value;

      if (!sid) {
        return NextResponse.redirect(new URL('/login', req.url));
      }

      const refreshResponse = await fetch(`${BACKEND_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sid, refreshToken }),
      });

      if (!refreshResponse.ok) {
        // Refresh failed (reuse detected / session revoked) — force logout
        const response = NextResponse.redirect(new URL('/login', req.url));
        response.cookies.delete('access_token');
        response.cookies.delete('refresh_token');
        response.cookies.delete('sid');
        return response;
      }

      const data = await refreshResponse.json();
      const isProd = process.env.NODE_ENV === 'production';
      const cookieOptions = {
        httpOnly: true,
        secure: isProd,
        sameSite: 'strict' as const,
        path: '/',
      };

      // Allow the request through and set the new rotated cookies
      const response = NextResponse.next();
      response.cookies.set('access_token', data.accessToken, { ...cookieOptions, maxAge: 15 * 60 });
      response.cookies.set('refresh_token', data.refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 });
      response.cookies.set('sid', data.sid, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 });
      return response;
    } catch {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  // Apply middleware to all routes, excluding the ones we handle internally
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
