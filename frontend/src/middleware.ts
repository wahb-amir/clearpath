import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, createRemoteJWKSet } from 'jose';

// Public routes (safe to access without auth)
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/api/auth/login',
  '/api/auth/refresh',
];

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

const JWKS = createRemoteJWKSet(
  new URL(`${BACKEND_URL}/auth/.well-known/jwks.json`)
);

// Proper route matcher (fixes "/" breaking everything)
function isPublicRoute(pathname: string) {
  return (
    pathname === '/' ||
    PUBLIC_ROUTES.filter((r) => r !== '/').some((route) =>
      pathname.startsWith(route)
    )
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Allow Next.js internals + static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(svg|png|jpg|ico|css|js)$/)
  ) {
    return NextResponse.next();
  }

  const accessToken = req.cookies.get('access_token')?.value;
  const refreshToken = req.cookies.get('refresh_token')?.value;

  // No auth at all → login
  if (!accessToken && !refreshToken) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Validate access token
  if (accessToken) {
    try {
      await jwtVerify(accessToken, JWKS, { algorithms: ['RS256'] });
      return NextResponse.next();
    } catch {
      // token invalid → try refresh below
    }
  }

  // Refresh flow
  if (refreshToken) {
    try {
      const sid = req.cookies.get('sid')?.value;

      if (!sid) {
        return NextResponse.redirect(new URL('/login', req.url));
      }

      const refreshResponse = await fetch(
        `${BACKEND_URL}/auth/refresh`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sid, refreshToken }),
        }
      );

      if (!refreshResponse.ok) {
        const res = NextResponse.redirect(new URL('/login', req.url));
        res.cookies.delete('access_token');
        res.cookies.delete('refresh_token');
        res.cookies.delete('sid');
        return res;
      }

      const data = await refreshResponse.json();
      const isProd = process.env.NODE_ENV === 'production';

      const cookieOptions = {
        httpOnly: true,
        secure: isProd,
        sameSite: 'strict' as const,
        path: '/',
      };

      const response = NextResponse.next();

      response.cookies.set('access_token', data.accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60,
      });

      response.cookies.set('refresh_token', data.refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60,
      });

      response.cookies.set('sid', data.sid, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60,
      });

      return response;
    } catch {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};