import { z } from "zod";
import { getGroqClient, getGroqModel, getGroqModelForStage } from "../../lib/llm/groqClient";
import type { ChatMessage } from "./types";
import {
  estimateMessagesTokens,
  SAFE_INPUT_TOKEN_BUDGET,
  truncateToTokenBudget,
} from "./promptBudget";

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

function shrinkMessagesFor413(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => {
    if (m.role !== "user") return m;
    try {
      const braceIndex = m.content.indexOf("{");
      if (braceIndex === -1) return m;
      
      const prefix = m.content.slice(0, braceIndex);
      const jsonStr = m.content.slice(braceIndex);
      const parsed = JSON.parse(jsonStr);
      
      if (typeof parsed.document_text === "string") {
        parsed.document_text = "[Omitted for repair pass. Rely on extracted items and prior context.]";
      }
      if (Array.isArray(parsed.official_source_snippets)) {
        parsed.official_source_snippets = parsed.official_source_snippets.map((s: any) => {
          if (s && typeof s.snippet === "string") {
            s.snippet = s.snippet.slice(0, 100) + "…";
          }
          return s;
        });
      }
      
      return {
        ...m,
        content: prefix + JSON.stringify(parsed, null, 2),
      };
    } catch {
      return m;
    }
  });
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
  const shrunken = shrinkMessagesFor413(originalMessages);
  return [
    ...shrunken,
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
  // Use stage-appropriate model: larger for verification/safety, faster default for others
  const model = getGroqModelForStage(stageLabel);

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
    if (
      (typeof error === "object" && error !== null && "status" in error && (error as any).status === 413) ||
      (error instanceof Error && error.message.includes("413"))
    ) {
      console.warn(`[${stageLabel}] 413 Request Too Large. Retrying with shrunken payload.`);
      try {
        const shrunkenMessages = shrinkMessagesFor413(messages);
        const retryCompletion = await withTimeout(
          client.chat.completions.create({
            model,
            temperature,
            messages: shrunkenMessages,
          }),
          Math.max(timeoutMs, 25000),
          `${stageLabel}-413-retry`,
        );
        const retryContent = retryCompletion.choices[0]?.message?.content ?? "";
        const retryResult = schema.safeParse(parseModelJson(retryContent));
        if (retryResult.success) {
          console.log(`[${stageLabel}] 413 retry succeeded`);
          return retryResult.data;
        }
        console.warn(`[${stageLabel}] 413 retry validation failed:`, retryResult.error.message);
      } catch (retryErr) {
        console.error(`[${stageLabel}] 413 retry failed:`, retryErr);
      }
    }

    console.error(`[${stageLabel}] streaming failed:`, error);
    return fallback;
  }
}

/**
 * Tool-use variant: sends a `tools` array and `tool_choice: "auto"` to
 * Groq alongside the streamed chat completion. Returns the assistant's
 * plain content (may be null when the model decided to call tools) plus
 * the parsed `tool_calls`. Does NOT validate against a Zod schema — the
 * agentic caller decides what to do with the tool arguments.
 *
 * Reuses the streaming / timeout / repair infrastructure above. The
 * repair pass is skipped because tool_use responses aren't JSON; if the
 * model emits an invalid structure we surface a discriminated
 * `{kind: "error"}` result so the agent loop can decide what to do.
 */
export type GroqToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type GroqToolStreamResult =
  | { kind: "ok"; content: string | null; tool_calls: GroqToolCall[]; finishReason: string }
  | { kind: "error"; error: string };

export interface GroqToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    /** JSON schema describing the function's parameters. */
    parameters: Record<string, unknown>;
  };
}

export async function askGroqJsonWithToolsStreaming(
  messages: ChatMessage[],
  tools: GroqToolDefinition[],
  temperature = 0,
  stageLabel = "LLM tool stage",
  onToken?: (tokensReceived: number, partial: string) => void | Promise<void>,
  timeoutMs = 60000,
): Promise<GroqToolStreamResult> {
  const client = getGroqClient();
  const model = getGroqModelForStage(stageLabel);

  console.log(`[${stageLabel}] streaming-tools start (${tools.length} tools)`);

  let content = "";
  let tokenCount = 0;
  const toolCallBuffers = new Map<
    number,
    { id: string; name: string; argsText: string; index: number }
  >();
  let finishReason = "stop";

  try {
    const stream = await withTimeout(
      client.chat.completions.create({
        model,
        temperature,
        messages,
        tools,
        tool_choice: "auto",
        stream: true,
      }),
      timeoutMs,
      stageLabel,
    );

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      const delta = choice?.delta;

      const textDelta = delta?.content ?? "";
      if (textDelta) {
        content += textDelta;
        tokenCount += textDelta.length;
        if (tokenCount % 80 < textDelta.length) {
          await onToken?.(tokenCount, content);
        }
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          // Groq streams tool_calls incrementally — index keys the deltas.
          const idx = tc.index ?? 0;
          const existing = toolCallBuffers.get(idx);
          if (!existing) {
            toolCallBuffers.set(idx, {
              id: tc.id ?? "",
              name: tc.function?.name ?? "",
              argsText: tc.function?.arguments ?? "",
              index: idx,
            });
          } else {
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name = tc.function.name;
            if (tc.function?.arguments) existing.argsText += tc.function.arguments;
          }
        }
      }

      if (choice?.finish_reason) {
        finishReason = choice.finish_reason;
      }
    }

    await onToken?.(tokenCount, content);

    const tool_calls: GroqToolCall[] = [];
    for (const buf of toolCallBuffers.values()) {
      let parsedArgs: Record<string, unknown> = {};
      if (buf.argsText.trim().length > 0) {
        try {
          parsedArgs = JSON.parse(buf.argsText);
          if (
            typeof parsedArgs !== "object" ||
            parsedArgs === null ||
            Array.isArray(parsedArgs)
          ) {
            parsedArgs = {};
          }
        } catch {
          // Surface as malformed argument — agent loop decides whether to retry
          return {
            kind: "error",
            error: `Failed to parse arguments for tool ${buf.name || "(unknown)"}`,
          };
        }
      }
      tool_calls.push({
        id: buf.id,
        name: buf.name,
        arguments: parsedArgs,
      });
    }

    console.log(
      `[${stageLabel}] streaming-tools done (${tool_calls.length} tool calls)`,
    );
    return {
      kind: "ok",
      content: content.trim().length === 0 ? null : content,
      tool_calls,
      finishReason,
    };
  } catch (error) {
    console.error(`[${stageLabel}] streaming-tools failed:`, error);
    return {
      kind: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

