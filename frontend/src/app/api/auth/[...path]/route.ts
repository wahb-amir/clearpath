import { NextRequest, NextResponse } from 'next/server';
import { setTokens, clearTokens, getAccessToken, getRefreshToken, getSid } from '@/lib/auth/cookies';

// In production, this would be an environment variable.
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const path = resolvedParams.path.join('/');
  
  if (path === 'login') {
    return handleLogin(req);
  } else if (path === 'refresh') {
    return handleRefresh(req);
  } else if (path === 'logout') {
    return handleLogout(req);
  }

  return NextResponse.json({ error: 'Not Found' }, { status: 404 });
}

async function handleLogin(req: NextRequest) {
  try {
    const body = await req.json();

    const response = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.error || 'Login failed' }, { status: response.status });
    }

    // Set secure HTTP-only cookies
    await setTokens(data.accessToken, data.refreshToken, data.sid);

    // Return a generic success message to the browser, do NOT leak tokens in the JSON payload
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function handleRefresh(req: NextRequest) {
  try {
    // Note: To be extremely secure, the BFF should know the `sid`.
    // In our backend design, `/auth/refresh` requires `sid` and `refreshToken`.
    // We didn't store `sid` directly in Next.js cookies, but we can extract it from the access token 
    // payload, or store it in an HttpOnly cookie too.
    // Let's decode the expired access token to get `sid`.
    const accessToken = await getAccessToken();
    const refreshToken = await getRefreshToken();

    if (!refreshToken) {
      return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
    }

    // Let's get the stored sid from cookies
    let sid = await getSid();

    if (!sid && accessToken) {
      // Fallback: decode it from access token if cookie is missing but token exists
      try {
        const payloadStr = Buffer.from(accessToken.split('.')[1], 'base64').toString('utf-8');
        const payload = JSON.parse(payloadStr);
        sid = payload.sid;
      } catch (e) {
        // Ignore
      }
    }

    if (!sid) {
      return NextResponse.json({ error: 'Missing session ID' }, { status: 401 });
    }

    const response = await fetch(`${BACKEND_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sid, refreshToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      await clearTokens(); // Revoke tokens in browser on failure
      return NextResponse.json({ error: data.error || 'Refresh failed' }, { status: response.status });
    }

    await setTokens(data.accessToken, data.refreshToken, data.sid);

    return NextResponse.json({ success: true });
  } catch (err) {
    await clearTokens();
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function handleLogout(req: NextRequest) {
  try {
    const accessToken = await getAccessToken();

    if (accessToken) {
      await fetch(`${BACKEND_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
    }
  } catch (err) {
    // Ignore backend errors on logout, still clear local cookies
  }

  await clearTokens();
  return NextResponse.json({ success: true });
}
