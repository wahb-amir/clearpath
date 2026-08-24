import type { AgentTool, AgentToolContext } from "../types";
import type { GroqToolDefinition } from "../../documentAnalysisPipeline/llmClient";
import { readDocumentSectionTool } from "./readDocumentSection";
import { searchDocumentChunksTool } from "./searchDocumentChunks";
import { webSearchTool } from "./webSearch";
import { extractCandidatesTool } from "./extractCandidates";
import { verifyAgainstSourcesTool } from "./verifyAgainstSources";
import { prepareRagIndexTool } from "./prepareRagIndex";
import { finalizeTool } from "./finalize";

/**
 * The full tool catalog the agent sees. Add a tool here and it shows
 * up in `tools[]` automatically.
 *
 * Typed as `AgentTool<string, unknown, unknown>[]` because TS can't
 * unify the heterogeneous generics across each tool's params/result.
 * The per-tool generic is preserved inside each entry; we only widen
 * for collection purposes.
 */
export const toolsCatalog: AgentTool<string, unknown, unknown>[] = [
  prepareRagIndexTool as unknown as AgentTool<string, unknown, unknown>,
  readDocumentSectionTool as unknown as AgentTool<string, unknown, unknown>,
  searchDocumentChunksTool as unknown as AgentTool<string, unknown, unknown>,
  webSearchTool as unknown as AgentTool<string, unknown, unknown>,
  extractCandidatesTool as unknown as AgentTool<string, unknown, unknown>,
  verifyAgainstSourcesTool as unknown as AgentTool<string, unknown, unknown>,
  finalizeTool as unknown as AgentTool<string, unknown, unknown>,
];

export interface ToolCatalog {
  tools: GroqToolDefinition[];
  handlers: Record<string, AgentTool<string, unknown, unknown>>;
}

export function buildToolCatalog(): ToolCatalog {
  const tools: GroqToolDefinition[] = [];
  const handlers: Record<string, AgentTool<string, unknown, unknown>> = {};
  for (const t of toolsCatalog) {
    tools.push({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    });
    handlers[t.name] = t;
  }
  return { tools, handlers };
}

/**
 * Looks up a tool by name; returns undefined if the model invented one.
 * The agent loop treats unknown tool names as a recoverable error
 * (returns `{ok:false, error:"unknown_tool"}` to the model so it can
 * self-correct on the next turn).
 */
export function findTool(
  catalog: ToolCatalog,
  name: string,
): AgentTool<string, unknown, unknown> | undefined {
  return catalog.handlers[name];
}
