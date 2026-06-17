// app/api/auth/refresh/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export async function POST(req) {
  try {
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

    // Extract cookies from backend response and apply them using NextJS cookies utility
    const cookieStore = await cookies();
    const setCookieHeaders = backendRes.headers.getSetCookie();

    for (const cookieStr of setCookieHeaders) {
      // Split the cookie into name=value and its attributes
      const parts = cookieStr.split(';');
      const [nameValue, ...rawAttrs] = parts;
      const [name, value] = nameValue.split('=');

      // Parse attributes into a structured object Next.js expects
      const options = {
        name: name.trim(),
        value: value.trim(),
      };

      rawAttrs.forEach(attr => {
        const [key, val] = attr.trim().split('=');
        const lowerKey = key.toLowerCase();
        
        if (lowerKey === 'path') options.path = val;
        if (lowerKey === 'domain') options.domain = val;
        if (lowerKey === 'max-age') options.maxAge = parseInt(val, 10);
        if (lowerKey === 'expires') options.expires = new Date(val);
        if (lowerKey === 'secure') options.secure = true;
        if (lowerKey === 'httponly') options.httpOnly = true;
        if (lowerKey === 'samesite') options.sameSite = val.toLowerCase();
      });

      // Set it directly to the response session store
      cookieStore.set(options);
    }

    return res;

  } catch (error) {
    console.error('Refresh route error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}