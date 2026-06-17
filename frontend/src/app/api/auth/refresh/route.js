// app/api/auth/refresh/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

function copySetCookies(from) {
  const anyHeaders = from ;

  const setCookies =
    typeof anyHeaders.getSetCookie === 'function'
      ? anyHeaders.getSetCookie()
      : from.get('set-cookie')
        ? [from.get('set-cookie')]
        : [];

  for (const cookie of setCookies) {
    to.headers.append('set-cookie', cookie);
  }
}

export async function POST(req) {
  const backendRes = await fetch(`${BACKEND_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      cookie: req.headers.get('cookie') ?? '',
      'content-type': 'application/json',
    },
    cache: 'no-store',
  });

  const body = await backendRes.json().catch(() => null);

  const res = NextResponse.json(body ?? { success: backendRes.ok }, {
    status: backendRes.status,
  });

  copySetCookies(backendRes.headers, res);

  return res;
}