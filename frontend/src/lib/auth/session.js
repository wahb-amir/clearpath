import { jwtVerify, createRemoteJWKSet } from 'jose';
import { getAccessToken } from './cookies';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

// Create a remote JWK Set to dynamically fetch and cache public keys
const JWKS = createRemoteJWKSet(new URL(`${BACKEND_URL}/auth/.well-known/jwks.json`));

export async function getSession() {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      algorithms: ['RS256'],
    });

    return {
      userId: payload.sub ,
      sid: payload.sid,
    };
  } catch (error) {
    // Token is invalid or expired
    return null;
  }
}
