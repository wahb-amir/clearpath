// src/lib/supabase.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { env } from "../config/env";

const supabaseUrl = env.SUPABASE_URL;
const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = env.SUPABASE_ANON_KEY;

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const supabaseAdmin: SupabaseClient = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
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

export function createSupabaseUserClient(
  accessToken: string
): SupabaseClient {
  const anonKey =
    supabaseAnonKey || getRequiredEnv("SUPABASE_ANON_KEY");

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

export { supabaseAdmin as supabase };