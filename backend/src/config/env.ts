import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file from the backend directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Redis for sessions
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  // MongoDB for users
  MONGODB_URI: z.string().default('mongodb://localhost:27017/clearpath'),

  // JWT Configuration
  ACCESS_TOKEN_EXPIRY: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRY_DAYS: z.coerce.number().default(7),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;
