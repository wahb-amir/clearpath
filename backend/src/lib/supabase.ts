// src/lib/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';

const supabaseUrl = env.SUPABASE_URL;
const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = env.SUPABASE_ANON_KEY; // Pulled from your type-safe env config

// Fallback utility in case certain keys are dynamic, though using your `env` object is preferred
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Server-only Supabase Admin client.
 * Bypasses Row Level Security (RLS). Use this for core auth logic, 
 * session creation, and administrative backend overrides.
 * * Never expose this or the service role key to the frontend/browser.
 */
export const supabaseAdmin: SupabaseClient = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  }
);

/**
 * Optional helper for creating a user-scoped Supabase client from an access token.
 * Useful if you ever implement RLS down the road and want the backend to 
 * masquerade as a specific user.
 */
export function createSupabaseUserClient(accessToken: string): SupabaseClient {
  const anonKey = supabaseAnonKey || getRequiredEnv('SUPABASE_ANON_KEY');
  
  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Clean alias export so you can use `import { supabase } from '...'` 
 * interchangeably with `supabaseAdmin` across your backend routes.
 */
export { supabaseAdmin as supabase };