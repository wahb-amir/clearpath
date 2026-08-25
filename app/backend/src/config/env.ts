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

  // ─── Redis URL (legacy/app usage) ──────────────────────
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // ─── Redis Detailed Config ─────────────────────────────
  REDIS_HOST: z.string().default("127.0.0.1"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),

  // ─── PostgreSQL ────────────────────────────────────────
  DATABASE_URL: z.string().url(),

  // ─── JWT Configuration ─────────────────────────────────
  ACCESS_TOKEN_EXPIRY: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRY_DAYS: z.coerce.number().default(7),

  // ─── Supabase ──────────────────────────────────────────
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),

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
  INTERNAL_API_KEY: z.string().min(16),

  CLEARPATH_ANALYSIS_QUEUE_NAME: z.string().default("clearpath-ai-analysis"),

  GROQ_API_KEY: z.string().startsWith("gsk_"),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),

  TAVILY_API_KEY: z.string(),
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
