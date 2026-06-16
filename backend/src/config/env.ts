import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file from the backend directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  // ─── Server ─────────────────────────────────────────────
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // ─── MongoDB ────────────────────────────────────────────
  MONGODB_URI: z.string().default('mongodb://localhost:27017/clearpath'),

  // ─── Redis URL (legacy/app usage) ──────────────────────
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // ─── Redis Detailed Config ─────────────────────────────
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),

  // ─── PostgreSQL ────────────────────────────────────────
  DATABASE_URL: z.string().url(),

  // ─── JWT Configuration ─────────────────────────────────
  ACCESS_TOKEN_EXPIRY: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRY_DAYS: z.coerce.number().default(7),

  // ─── Supabase ──────────────────────────────────────────
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),

  // ─── Analysis Pipeline ─────────────────────────────────
  ANALYSIS_QUEUE_NAME: z.string().default('document-analysis'),
  ANALYSIS_JOB_ATTEMPTS: z.coerce.number().default(5),
  ANALYSIS_VERSION: z.string().default('v1'),

  // ─── Worker ────────────────────────────────────────────
  WORKER_ID: z.string().default('worker-1'),

  // ─── OCR / Tesseract ───────────────────────────────────
  TESSERACT_LANGS: z.string().default('eng+urd'),
  OCR_MIN_TEXT_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.6),

  // ─── Transformers Cache ────────────────────────────────
  TRANSFORMERS_CACHE: z.string().default('/var/cache/transformers'),

  // ─── Outbox Dispatcher ─────────────────────────────────
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().default(2000),
  OUTBOX_MAX_RETRIES: z.coerce.number().default(10),

  // ─── SSE ───────────────────────────────────────────────
  SSE_HEARTBEAT_INTERVAL_MS: z.coerce.number().default(15000),

  // ─── Internal APIs ─────────────────────────────────────
  INTERNAL_API_KEY: z.string().min(16),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;