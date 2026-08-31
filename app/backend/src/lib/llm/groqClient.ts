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
      "Missing GROQ_API_KEY. Set it to your Groq key (usually starting with gsk_).",
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

/**
 * Get the appropriate model for a specific pipeline stage.
 * Uses larger model for critical reasoning stages (verification, safety),
 * faster default model for other stages.
 */
export function getGroqModelForStage(stageLabel: string): string {
  const defaultModel = env.GROQ_MODEL;

  // Use larger model for stages requiring careful reasoning
  if (stageLabel === "stage3" || stageLabel === "stage5") {
    // Can be overridden via env var for even larger model if needed
    return env.GROQ_MODEL_VERIFICATION ?? "openai/gpt-oss-20b"; // Use same 20B for now, can upgrade later
  }

  return defaultModel;
}
