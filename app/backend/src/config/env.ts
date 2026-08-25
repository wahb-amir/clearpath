import { z } from "zod";
import dotenv from "dotenv";
import path from "path";

// Load .env file from the backend directory
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const envSchema = z.object({
  // ─── Server ─────────────────────────────────────────────
  PORT: z.string().default("3001"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // ─── Redis URL (preferred) ────────────────────────────
  // Prefer a single REDIS_URL (e.g. rediss://... on Upstash). Falls back
  // to localhost only if neither REDIS_URL nor any of the granular
  // REDIS_HOST/PORT/... are set in the environment.
  REDIS_URL: z.string().optional(),

  // ─── Redis Detailed Config ─────────────────────────────
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().optional(),

  // ─── PostgreSQL ────────────────────────────────────────
  // Optional so the API can boot on a HF Space before the user has
  // configured all the secrets; routes that actually need the DB will
  // surface a clear error at request time instead of crashing the
  // process at startup.
  DATABASE_URL: z.string().url().optional(),

  // ─── JWT Configuration ─────────────────────────────────
  ACCESS_TOKEN_EXPIRY: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRY_DAYS: z.coerce.number().default(7),

  // ─── Supabase ──────────────────────────────────────────
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),

  // ─── Analysis Pipeline ─────────────────────────────────
  ANALYSIS_QUEUE_NAME: z.string().default("document-analysis"),
  ANALYSIS_JOB_ATTEMPTS: z.coerce.number().default(5),
  ANALYSIS_VERSION: z.string().default("v1"),

  // ─── OCR Pipeline Stage (isolated queue, Python consumer) ─
  // Deliberately a SEPARATE BullMQ queue from ANALYSIS_QUEUE_NAME so
  // the Node worker and the Python ocr-engine service are never
  // competing consumers on the same queue - each only ever sees jobs
  // meant for it.
  OCR_QUEUE_NAME: z.string().default("document-ocr"),
  OCR_JOB_ATTEMPTS: z.coerce.number().default(5),

  // ─── Worker ────────────────────────────────────────────
  WORKER_ID: z.string().default("worker-1"),

  // ─── Transformers Cache ────────────────────────────────
  TRANSFORMERS_CACHE: z.string().default("/var/cache/transformers"),

  // ─── Outbox Dispatcher ─────────────────────────────────
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().default(2000),
  OUTBOX_MAX_RETRIES: z.coerce.number().default(10),

  // ─── SSE ───────────────────────────────────────────────
  SSE_HEARTBEAT_INTERVAL_MS: z.coerce.number().default(15000),

  // ─── Internal APIs ─────────────────────────────────────
  // Generated lazily if not provided so the server can boot on a HF
  // Space without a manually-configured secret.
  INTERNAL_API_KEY: z.string().min(16).optional(),

  CLEARPATH_ANALYSIS_QUEUE_NAME: z.string().default("clearpath-ai-analysis"),

  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),

  TAVILY_API_KEY: z.string().optional(),
  FRONTEND_URL: z.string().default("http://localhost:3000"),

  // ─── Agentic AI Pipeline ────────────────────────────────
  // Global kill-switch. When false, every analysis request is forced
  // onto the classic pipeline regardless of the `?pipeline=` query
  // param. Defaults to true so opt-in is the default; flip to false in
  // staging/prod environments that aren't ready for the agent yet.
  AGENTIC_PIPELINE_ENABLED: z
    .union([z.boolean(), z.string()])
    .default(true)
    .transform((v) => (typeof v === "boolean" ? v : v !== "false" && v !== "0")),

  // Default pipeline when the client does NOT pass `?pipeline=` on the
  // analyze endpoint. Clients can still override per request with
  // `?pipeline=agentic` or `?pipeline=classic` (when
  // AGENTIC_PIPELINE_ENABLED is true).
  AGENTIC_PIPELINE_DEFAULT: z
    .enum(["classic", "agentic"])
    .default("classic"),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:", _env.error.format());
  process.exit(1);
}

export const env = _env.data;

/**
 * Resolved Redis connection parameters.
 * - Prefers `REDIS_URL` if set (works for rediss:// Upstash URLs, redis://, etc.)
 * - Falls back to granular `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_DB`
 * - Last-resort default: redis://localhost:6379
 */
export const resolvedRedis = (() => {
  if (env.REDIS_URL && env.REDIS_URL.length > 0) {
    return { url: env.REDIS_URL };
  }
  if (env.REDIS_HOST) {
    return {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT ?? 6379,
      password: env.REDIS_PASSWORD || undefined,
      db: env.REDIS_DB ?? 0,
    };
  }
  return { url: "redis://localhost:6379" };
})();
