import { cookies } from 'next/headers';

const ACCESS_TOKEN_NAME = 'access_token';
const REFRESH_TOKEN_NAME = 'refresh_token';
const SID_NAME = 'sid';

// In production, require HTTPS for cookies
const isProd = process.env.NODE_ENV === 'production';

export async function setTokens(accessToken: string, refreshToken: string, sid?: string, maxAge?: number) {
  const cookieStore = await cookies();
  
  cookieStore.set(ACCESS_TOKEN_NAME, accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: 15 * 60, // 15 mins for access token
  });

  cookieStore.set(REFRESH_TOKEN_NAME, refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: maxAge || 7 * 24 * 60 * 60, // 7 days for refresh token
  });

  if (sid) {
    cookieStore.set(SID_NAME, sid, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      path: '/',
      maxAge: maxAge || 7 * 24 * 60 * 60, // Keep sid as long as refresh token
    });
  }
}

export async function clearTokens() {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_TOKEN_NAME);
  cookieStore.delete(REFRESH_TOKEN_NAME);
  cookieStore.delete(SID_NAME);
}

export async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_TOKEN_NAME)?.value;
}

export async function getRefreshToken() {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_TOKEN_NAME)?.value;
}

export async function getSid() {
  const cookieStore = await cookies();
  return cookieStore.get(SID_NAME)?.value;
}
