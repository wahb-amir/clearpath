import Redis from 'ioredis';
import crypto from 'crypto';
import { env } from '../config/env';

const redis = new Redis(env.REDIS_URL);

// Hash function to securely store the refresh token
const hashToken = (token: string) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const getTTLSeconds = () => env.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60;

export const createSession = async (
  userId: string,
  refreshToken: string,
  deviceMeta: string,
  ip: string
) => {
  const sid = crypto.randomUUID();
  // Family ID groups all tokens derived from the initial login
  const familyId = crypto.randomUUID();
  
  const tokenHash = hashToken(refreshToken);

  const sessionData = {
    userId,
    familyId,
    refreshTokenHash: tokenHash,
    deviceMeta,
    ip,
    createdAt: Date.now().toString(),
  };

  const ttl = getTTLSeconds();

  // Transaction to create session and index it
  const pipeline = redis.pipeline();
  pipeline.hset(`session:${sid}`, sessionData);
  pipeline.expire(`session:${sid}`, ttl);
  
  // Track sid in the family
  pipeline.sadd(`family:${familyId}`, sid);
  pipeline.expire(`family:${familyId}`, ttl);

  // Track sid for the user (for global logout)
  pipeline.sadd(`user:${userId}:sessions`, sid);

  await pipeline.exec();

  return { sid, familyId };
};

export const refreshSession = async (
  sid: string,
  oldRefreshToken: string,
  newRefreshToken: string
) => {
  const session = await redis.hgetall(`session:${sid}`);

  if (!session || !session.refreshTokenHash) {
    throw new Error('Session not found or invalid');
  }

  const providedHash = hashToken(oldRefreshToken);

  if (session.refreshTokenHash !== providedHash) {
    // REUSE DETECTED!
    // The provided token doesn't match what's active in the DB.
    // This implies an old, already rotated token is being used.
    console.warn(`[SECURITY] Refresh token reuse detected for family ${session.familyId}! Revoking all sessions.`);
    await revokeFamily(session.familyId);
    throw new Error('Token reused - session family revoked');
  }

  // Valid rotation
  const newTokenHash = hashToken(newRefreshToken);
  const ttl = getTTLSeconds();

  // Create a new session ID for the rotated token
  const newSid = crypto.randomUUID();
  
  const sessionData = {
    ...session,
    refreshTokenHash: newTokenHash,
    createdAt: Date.now().toString(), // Update rotation time
  };

  const pipeline = redis.pipeline();
  // Store new session
  pipeline.hset(`session:${newSid}`, sessionData);
  pipeline.expire(`session:${newSid}`, ttl);
  
  // Add new session to family
  pipeline.sadd(`family:${session.familyId}`, newSid);
  pipeline.expire(`family:${session.familyId}`, ttl);

  // Update user sessions index
  pipeline.sadd(`user:${session.userId}:sessions`, newSid);
  pipeline.srem(`user:${session.userId}:sessions`, sid); // Remove old

  // Invalidate old session immediately
  pipeline.del(`session:${sid}`);

  await pipeline.exec();

  return { newSid, userId: session.userId };
};

export const revokeSession = async (sid: string) => {
  const session = await redis.hgetall(`session:${sid}`);
  if (session && session.userId) {
    const pipeline = redis.pipeline();
    pipeline.del(`session:${sid}`);
    pipeline.srem(`user:${session.userId}:sessions`, sid);
    await pipeline.exec();
  }
};

export const revokeFamily = async (familyId: string) => {
  const sids = await redis.smembers(`family:${familyId}`);
  if (sids.length === 0) return;

  const pipeline = redis.pipeline();
  for (const sid of sids) {
    // Get the user ID to clean up user indices, but we can just blindly del sessions
    pipeline.del(`session:${sid}`);
  }
  pipeline.del(`family:${familyId}`);
  await pipeline.exec();
};
