import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import crypto from 'crypto';

// Load keys
const keysDir = path.resolve(__dirname, '../../.keys');
let privateKey = '';
let publicKey = '';

try {
  privateKey = fs.readFileSync(path.join(keysDir, 'private.pem'), 'utf8');
  publicKey = fs.readFileSync(path.join(keysDir, 'public.pem'), 'utf8');
} catch (e) {
  console.warn('⚠️ RS256 keys not found. Run "node scripts/generate-keys.js" first.');
}

const KID = 'key-1'; // Key ID for rotation

export const signAccessToken = (userId: string, sessionId: string) => {
  return jwt.sign(
    { sub: userId, sid: sessionId },
    privateKey as jwt.Secret,
    {
      algorithm: 'RS256',
      expiresIn: env.ACCESS_TOKEN_EXPIRY,
      keyid: KID,
    } as jwt.SignOptions
  );
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as jwt.JwtPayload;
};

export const generateRefreshToken = () => {
  return crypto.randomBytes(40).toString('hex');
};

export const getJwks = () => {
  // Simplistic JWKS representation of the public key
  // Normally you'd convert the PEM to JWK format (e.g. using 'pem-jwk' or 'node-jose')
  // We'll provide a basic mock or just the PEM if requested
  return {
    keys: [
      {
        kty: 'RSA',
        alg: 'RS256',
        use: 'sig',
        kid: KID,
        // In a real system, you'd extract n and e from the PEM
        // For simplicity, we just provide the PEM in the x5c field
        x5c: [
          publicKey
            .replace('-----BEGIN PUBLIC KEY-----\n', '')
            .replace('\n-----END PUBLIC KEY-----\n', '')
            .replace(/\n/g, '')
        ]
      }
    ]
  };
};

export const getPublicKeyPem = () => publicKey;
