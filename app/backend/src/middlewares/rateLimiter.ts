import { Request, Response, NextFunction } from "express";
import { RateLimitError } from "../types/errors";

// Simple in-memory rate limiter
// In production, use `express-rate-limit` with a Redis store
const requestCounts = new Map<string, { count: number; resetTime: number }>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 20; // per IP per window

/**
 * Sends a standardized rate limit response with retry-after information
 */
function sendRateLimitResponse(
  res: Response,
  message: string,
  resetTime: number,
): void {
  const retryAfterSeconds = Math.ceil((resetTime - Date.now()) / 1000);
  const retryAfter = Math.max(1, retryAfterSeconds);

  // Set standard Retry-After header (in seconds)
  res.setHeader("Retry-After", retryAfter.toString());

  // Also include in response body for clients that can't read headers
  res.status(429).json({
    error: message,
    code: "RATE_LIMITED",
    retryAfter,
    retryAfterHuman: formatRetryAfter(retryAfter),
  });
}

/**
 * Formats retry-after seconds into a human-readable string
 */
function formatRetryAfter(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
}

export const rateLimiter = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now > record.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    next();
    return;
  }

  record.count++;
  if (record.count > MAX_REQUESTS) {
    sendRateLimitResponse(
      res,
      "Too many requests. Please try again later.",
      record.resetTime,
    );
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
const REFRESH_MAX_REQUESTS = 10; // more lenient than global limiter

export const refreshRateLimiter = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
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
    sendRateLimitResponse(
      res,
      "Too many refresh requests. Please wait a moment and try again.",
      record.resetTime,
    );
    return;
  }

  next();
};
