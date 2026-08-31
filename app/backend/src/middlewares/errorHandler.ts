import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError, RateLimitError } from "../types/errors";

/**
 * Global Express error handler. Mount this LAST in src/index.ts
 * (after all routes) with:
 *   app.use(errorHandler);
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // Handle body-parser malformed JSON errors (which set status = 400)
  if (err instanceof SyntaxError && "status" in err && err.status === 400 && "body" in err) {
    res.status(400).json({
      error: "Invalid JSON format in request body",
      code: "INVALID_JSON",
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      issues: err.issues,
    });
    return;
  }

  if (err instanceof RateLimitError) {
    const retryAfter = err.retryAfter ?? 60;
    res.setHeader("Retry-After", retryAfter.toString());
    res.status(429).json({
      error: err.message,
      code: err.code,
      retryAfter,
      retryAfterHuman: formatRetryAfter(retryAfter),
      details: err.details ?? undefined,
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details ?? undefined,
    });
    return;
  }

  // Unexpected error - do not leak internals
  console.error("[unhandled error]", err);
  res.status(500).json({
    error: "An unexpected error occurred. Please try again later.",
    code: "INTERNAL_SERVER_ERROR",
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
