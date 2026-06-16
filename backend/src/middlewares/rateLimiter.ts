import { Request, Response, NextFunction } from 'express';

// Simple in-memory rate limiter
// In production, use `express-rate-limit` with a Redis store
const requestCounts = new Map<string, { count: number; resetTime: number }>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 20;           // per IP per window

export const rateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now > record.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    next();
    return;
  }

  record.count++;
  if (record.count > MAX_REQUESTS) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return;
  }

  next();
};

// Separate limiter ONLY for refresh endpoint
const refreshRequestCounts = new Map<
  string,
  { count: number; resetTime: number }
>();

const REFRESH_WINDOW_MS = 60 * 1000; // 1 minute
const REFRESH_MAX_REQUESTS = 10;      // more lenient than global limiter

export const refreshRateLimiter = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = refreshRequestCounts.get(ip);

  if (!record || now > record.resetTime) {
    refreshRequestCounts.set(ip, {
      count: 1,
      resetTime: now + REFRESH_WINDOW_MS,
    });
    next();
    return;
  }

  record.count++;

  if (record.count > REFRESH_MAX_REQUESTS) {
    res.status(429).json({
      error: 'Too many refresh requests. Please wait a moment and try again.',
    });
    return;
  }

  next();
};