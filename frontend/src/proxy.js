import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { cookies } from 'next/headers';
const PUBLIC_ROUTES = ['/', '/login', '/register', '/about'];
const PUBLIC_API_PREFIXES = ['/api/auth'];

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

const JWKS = createRemoteJWKSet(
  new URL(`${BACKEND_URL}/auth/.well-known/jwks.json`)
);

const cookieBaseOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' ,
  path: '/',
};

function isPublicRoute(pathname) {
  return PUBLIC_ROUTES.includes(pathname);
}

function isPublicApiRoute(pathname) {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function shouldSkipMiddleware(pathname) {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    /\.(svg|png|jpg|jpeg|ico|css|js|map)$/.test(pathname)
  );
}

function redirectToLogin(req) {
  return NextResponse.redirect(new URL('/login', req.url));
}

async function isValidJwt(token) {
  try {
    await jwtVerify(token, JWKS);
    return true;
  } catch {
    return false;
  }
}

export async function refreshAccessToken() {
  const cookieStore = await cookies();

  // 1. Properly format existing cookies to pass to your backend
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  const res = await fetch(`${BACKEND_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'cookie': cookieHeader,
      'content-type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) return null;

  const data = await res.json().catch(() => null);

  // 2. Extract the Set-Cookie headers sent by your backend
  const setCookies =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : res.headers.get('set-cookie')
        ? [res.headers.get('set-cookie')]
        : [];

  // 3. Parse and set each cookie into Next.js cookie store
  for (const cookieStr of setCookies) {
    const parts = cookieStr.split(';').map((p) => p.trim());
    if (parts.length === 0) continue;

    // Separate the 'name=value' from the options (Max-Age, HttpOnly, etc.)
    const [nameWithValue, ...options] = parts;
    const eqIdx = nameWithValue.indexOf('=');
    if (eqIdx === -1) continue;

    const name = nameWithValue.substring(0, eqIdx);
    // Decode the value so Next.js doesn't double-encode it when saving
    const value = decodeURIComponent(nameWithValue.substring(eqIdx + 1));

    const cookieOptions = { path: '/' }; // Default fallback path

    // Map backend cookie attributes to Next.js cookie options
    options.forEach((opt) => {
      const [optName, optVal] = opt.split('=');
      const lowerKey = optName.toLowerCase();

      if (lowerKey === 'httponly') cookieOptions.httpOnly = true;
      if (lowerKey === 'secure') cookieOptions.secure = true;
      if (lowerKey === 'max-age') cookieOptions.maxAge = parseInt(optVal, 10);
      if (lowerKey === 'expires') cookieOptions.expires = new Date(optVal);
      if (lowerKey === 'path') cookieOptions.path = optVal;
      if (lowerKey === 'samesite') {
        const val = optVal.toLowerCase();
        cookieOptions.sameSite = val === 'lax' || val === 'strict' || val === 'none' ? val : true;
      }
    });

    // Save it directly onto Next.js response headers
    cookieStore.set(name, value, cookieOptions);
  }

  return {
    accessToken: data?.accessToken ?? null,
    success: true,
  };
}

export async function proxy(req) {
  const { pathname } = req.nextUrl;

  if (
    shouldSkipMiddleware(pathname) ||
    isPublicRoute(pathname) ||
    isPublicApiRoute(pathname)
  ) {
    return NextResponse.next();
  }

  const accessToken = req.cookies.get('accessToken')?.value;
  const refreshToken = req.cookies.get('refreshToken')?.value;
  const sid = req.cookies.get('sid')?.value;

  if (!accessToken && !refreshToken) {
    return redirectToLogin(req);
  }

  if (accessToken && (await isValidJwt(accessToken))) {
    return NextResponse.next();
  }

  if (!refreshToken) {
    return redirectToLogin(req);
  }

  const newAccessToken = await refreshAccessToken(refreshToken, sid);

  if (!newAccessToken || !(await isValidJwt(newAccessToken))) {
    return redirectToLogin(req);
  }

  const response = NextResponse.next();
  response.cookies.set('accessToken', newAccessToken, cookieBaseOptions);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
};