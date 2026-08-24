import { z } from "zod";
import { getGroqClient, getGroqModel } from "../../lib/llm/groqClient";
import type { ChatMessage } from "./types";

/**
 * Strip leading/trailing code fences that Groq sometimes adds around
 * JSON responses. Handles ```` ```json ````, ```` ```jsonc ````, etc.
 */
function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json|jsonc|javascript|ts|typescript)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

/**
 * Find the first balanced JSON object or array in `text` and return it.
 * Walks the string tracking brace depth and string-literal state so we
 * don't get tripped up by braces that appear inside quoted strings.
 */
function extractJsonSlice(text: string): string {
  const cleaned = stripCodeFences(text);
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");

  const start =
    firstBrace === -1
      ? firstBracket
      : firstBracket === -1
        ? firstBrace
        : Math.min(firstBrace, firstBracket);

  if (start < 0) return cleaned.trim();

  const opening = cleaned[start];
  const closing = opening === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === `"`) {
        inString = false;
      }
      continue;
    }

    if (ch === `"`) {
      inString = true;
      continue;
    }

    if (ch === opening) depth++;
    if (ch === closing) {
      depth--;
      if (depth === 0) return cleaned.slice(start, i + 1);
    }
  }

  return cleaned.slice(start).trim();
}

function parseModelJson(input: string): unknown {
  const slice = extractJsonSlice(input);
  return JSON.parse(slice);
}

/**
 * Build the message list for a one-shot repair pass: we feed the model
 * its own previous (invalid) response plus a user turn that explains
 * the validation error and asks for strict JSON only.
 */
function buildRepairMessages(
  originalMessages: ChatMessage[],
  rawContent: string,
  validationError: string,
): ChatMessage[] {
  return [
    ...originalMessages,
    {
      role: "assistant",
      content: rawContent,
    },
    {
      role: "user",
      content:
        "The previous response failed schema validation.\n\n" +
        `Validation error:\n${validationError}\n\n` +
        "Return corrected strict JSON only. Do not add commentary. Keep the same shape.",
    },
  ];
}

/**
 * Race a promise against a timeout. Rejects with a clear `${label} timed
 * out after ${ms}ms` error so callers can surface a meaningful message.
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer!);
  });
}



/**
 * Streaming variant of askGroqJson.
 *
 * Uses Groq's streaming API so we can fire `onToken` heartbeat ticks while
 * the model is generating — the frontend sees live activity instead of a
 * silent pause. The full response is accumulated, then parsed + validated
 * exactly like askGroqJson. Repair pass falls back to a non-streaming call.
 */
export async function askGroqJsonStreaming<T>(
  messages: ChatMessage[],
  schema: z.ZodType<T>,
  fallback: T,
  temperature = 0,
  stageLabel = "LLM stage",
  onToken?: (tokensReceived: number, partial: string) => void | Promise<void>,
  timeoutMs = 30000,
): Promise<T> {
  const client = getGroqClient();
  const model = getGroqModel();

  console.log(`[${stageLabel}] streaming start`);

  let content = "";
  let tokenCount = 0;

  try {
    const stream = await withTimeout(
      client.chat.completions.create({
        model,
        temperature,
        messages,
        stream: true,
      }),
      timeoutMs,
      stageLabel,
    );

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        content += delta;
        tokenCount += delta.length; // rough char count, fine for progress
        // Fire every ~80 chars (~20 tokens) so we get ~10-30 ticks per stage
        if (tokenCount % 80 < delta.length) {
          await onToken?.(tokenCount, content);
        }
      }
    }

    // Always fire a final tick so the caller knows streaming ended
    await onToken?.(tokenCount, content);

    const parsed = parseModelJson(content);
    const result = schema.safeParse(parsed);

    if (result.success) {
      console.log(`[${stageLabel}] streaming completed`);
      return result.data;
    }

    console.warn(
      `[${stageLabel}] streaming validation failed:`,
      result.error.message,
    );

    // Repair pass (non-streaming is fine — it's a short correction)
    const repairMessages = buildRepairMessages(
      messages,
      content,
      result.error.message,
    );
    try {
      const repairCompletion = await withTimeout(
        client.chat.completions.create({
          model,
          temperature: 0,
          messages: repairMessages,
        }),
        Math.max(timeoutMs, 25000),
        `${stageLabel}-repair`,
      );
      const repairContent = repairCompletion.choices[0]?.message?.content ?? "";
      const repairResult = schema.safeParse(parseModelJson(repairContent));
      if (repairResult.success) {
        console.log(`[${stageLabel}] streaming repair succeeded`);
        return repairResult.data;
      }
      console.warn(
        `[${stageLabel}] streaming repair also failed:`,
        repairResult.error.message,
      );
    } catch (repairErr) {
      console.error(`[${stageLabel}] streaming repair threw:`, repairErr);
    }

    console.warn(`[${stageLabel}] using fallback`);
    return fallback;
  } catch (error) {
    console.error(`[${stageLabel}] streaming failed:`, error);
    return fallback;
  }
}
