// src/lib/supabase.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { env } from "../config/env";

const supabaseUrl = env.SUPABASE_URL;
<<<<<<< HEAD
const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = env.SUPABASE_ANON_KEY;

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

=======
const supabaseSecretKey = env.SUPABASE_SECRET_KEY;
const supabasePublishableKey = env.SUPABASE_PUBLISHABLE_KEY;

/**
 * Server-only Supabase Admin client.
 * Use the secret key here. Never expose it to the browser.
 */
>>>>>>> d801dcdfb3f446ac2535cf817dcc5097dd2054a9
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

<<<<<<< HEAD
export function createSupabaseUserClient(
  accessToken: string
): SupabaseClient {
  const anonKey =
    supabaseAnonKey || getRequiredEnv("SUPABASE_ANON_KEY");

  return createClient(supabaseUrl, anonKey, {
=======
/**
 * Optional helper for creating a user-scoped Supabase client from an access token.
 * Use the publishable key here, then pass the user's JWT in the Authorization header.
 */
export function createSupabaseUserClient(accessToken: string): SupabaseClient {
  return createClient(supabaseUrl, supabasePublishableKey, {
>>>>>>> d801dcdfb3f446ac2535cf817dcc5097dd2054a9
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