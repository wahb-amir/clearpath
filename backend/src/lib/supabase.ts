// src/lib/supabase.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { env } from "../config/env";

const supabaseUrl = env.SUPABASE_URL;
const supabaseSecretKey = env.SUPABASE_SECRET_KEY;
const supabasePublishableKey = env.SUPABASE_PUBLISHABLE_KEY;

/**
 * Server-only Supabase Admin client.
 * Use the secret key here. Never expose it to the browser.
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
  }
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