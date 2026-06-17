import Groq from "groq-sdk";
import { env } from "../../config/env";
export interface GroqClientOptions {
  apiKey?: string;
}

let cachedClient: Groq | null = null;

export function createGroqClient(options: GroqClientOptions = {}): Groq {
  const apiKey = env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing GROQ_API_KEY. Set it to your Groq key (usually starting with gsk_)."
    );
  }

  return new Groq({ apiKey });
}

/**
 * Lazy singleton so importing this file does not crash test/dev processes
 * before environment variables are loaded.
 */
export function getGroqClient(): Groq {
  if (!cachedClient) {
    cachedClient = createGroqClient();
  }

  return cachedClient;
}

export function getGroqModel(): string {
  return env.GROQ_MODEL;
}
