import type { NormalizedDocument } from "../../types/documentAnalysis";

/**
 * System message for the agent. Establishes role, audit boundary (no
 * outside-doc invention), and the available tool vocabulary. The agent
 * uses this exact prompt as the first system turn.
 *
 * Keep this concise: every turn re-includes it in the model's context
 * budget. Tool descriptions live in the `tools` array sent to Groq, so
 * we don't enumerate them again here.
 */
export function buildAgentSystemPrompt(): string {
  return `You are ClearPath Agent — a specialist that helps immigrants, refugees, and underserved communities understand complex official documents by selecting tools to read the document, retrieve context, and synthesize the user-facing answer.

ROLE
- You decide which tool calls to make, in what order, and when to stop.
- You can SKIP work that isn't relevant. A short, simple document does not need web search or vector retrieval — go straight to extraction.
- For long, dense, or unstructured documents you SHOULD use multiple tools (read sections, search chunks, run web searches) to gather evidence before extracting.

RULES (FOLLOW STRICTLY)
1. Read only the provided document. Never invent, assume, or extrapolate beyond it or the tool results you receive.
2. When you call a tool, the system will run it and return JSON. Wait for the tool result before calling another tool.
3. Always terminate your run by calling the "finalize" tool with the user-facing synthesis payload. Do not stop without calling finalize.
4. If a tool errors or returns no useful data, try a different tool — do not give up.
5. needs_human_review: true MUST be set in your finalize payload if the document involves legal rights, appeal processes, benefit eligibility, medical information, immigration status, evictions, financial penalties, or any high-stakes decision.
6. trusted_sources: only include URLs that come from web_search or search_document_chunks results you actually received. Never invent URLs.
7. When unsure whether to call another tool, prefer calling finalize with what you have rather than looping endlessly.`;
}

/**
 * Initial user task — describes the document and the goal. We pin the
 * document text + section list on the first turn so subsequent turns
 * can re-reference it cheaply without re-sending everything.
 *
 * To keep the per-turn token budget under control we attach the
 * sections metadata (id/title/order) but NOT every section's text —
 * the agent can call `read_document_section` to fetch body content on
 * demand.
 */
export function buildAgentInitialTask(document: NormalizedDocument): string {
  const sections = (document.sections ?? []).map((s, idx) => ({
    index: idx,
    section_id: s.section_id,
    title: s.title ?? null,
    snippet: s.content.slice(0, 200),
  }));

  return JSON.stringify(
    {
      task: "Analyze this document using the available tools.",
      document: {
        document_id: document.document_id,
        file_type: document.file_type,
        language: document.language ?? null,
        // Full source_text is included so simple short docs don't need any tool calls.
        source_text: document.source_text,
        // Section metadata for selective reading.
        sections,
      },
      workflow: [
        "1. Decide what you need. Short doc? call extract_candidates, then verify_against_sources, then finalize.",
        "2. Long doc? call prepare_rag_index once, then read_document_section / search_document_chunks to recall evidence, then extract_candidates and verify_against_sources, then finalize.",
        "3. Web search is OPTIONAL — use it only when you need to confirm an external claim or cite an official source.",
        "4. ALWAYS finish by calling the finalize tool with the Stage-4-shaped payload.",
      ],
      output_requirements: {
        finalize_payload: {
          ai_summary: "2-4 sentences. Plain English.",
          action_items: "Array of {text, priority, supporting_evidence, completed:false}",
          key_deadlines: "Array of {text, meaning, priority, supporting_evidence}",
          questions_to_ask: "Array of plain questions the reader would ask",
          ai_confidence: "{overall, summary, actions, deadlines, questions} all 0-1",
          trusted_sources: "Array of {title, url, why_it_matters} — URLs must come from tool results",
          needs_human_review: "boolean",
          human_review_reason: "One sentence — required non-empty string",
        },
      },
    },
    null,
    2,
  );
}
