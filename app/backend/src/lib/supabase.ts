// src/lib/supabase.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { env } from "../config/env";

// Defensive fallbacks so the module can be imported on a HF Space before
// SUPABASE_URL / SUPABASE_SECRET_KEY have been wired up. The real client
// will be re-built (lazily) by `createClient` callsites once secrets land.
const supabaseUrl = env.SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseSecretKey = env.SUPABASE_SECRET_KEY ?? "placeholder-secret-key";
const supabasePublishableKey =
  env.SUPABASE_PUBLISHABLE_KEY ?? "placeholder-publishable-key";

/**
 * Server-only Supabase Admin client.
 * Use the secret key here. Never expose it to the browser.
 *
 * NOTE: a placeholder client is built at import time so the API can boot
 * on a HF Space before secrets land. Real requests will fail loudly with
 * a Supabase auth error (instead of crashing the process at startup) –
 * the route handler decides whether to surface that as 500 or fall back.
 */
export const supabaseAdmin: SupabaseClient = createClient(
  supabaseUrl,
  supabaseSecretKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    realtime: {
      transport: WebSocket,
    },
  },
);

/**
 * Optional helper for creating a user-scoped Supabase client from an access token.
 * Use the publishable key here, then pass the user's JWT in the Authorization header.
 */
export function createSupabaseUserClient(accessToken: string): SupabaseClient {
  return createClient(supabaseUrl, supabasePublishableKey, {
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

export { supabaseAdmin as supabase };
