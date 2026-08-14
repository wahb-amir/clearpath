import { z } from "zod";

/**
 * Stage 1 — Document Understanding
 *
 * Asks the LLM to identify the document's type, primary topic, intended
 * audience, and whether the document contains deadlines / actions / risks.
 * Also asks for an initial `needs_human_review` flag and the document's
 * declared language.
 */
export const Stage1Schema = z.object({
  document_type: z.enum([
    "notice",
    "letter",
    "form",
    "email",
    "policy",
    "instruction",
    "other",
  ]),
  primary_topic: z.string().min(1),
  intended_audience: z.enum([
    "student",
    "parent",
    "caregiver",
    "community_member",
    "other",
    "unclear",
  ]),
  is_support_related: z.boolean(),
  possible_user_problem: z.string().min(1),
  contains_deadlines: z.boolean(),
  contains_actions: z.boolean(),
  contains_risks: z.boolean(),
  needs_human_review: z.boolean(),
  human_review_reason: z
    .string()
    .transform((v) => v.trim() || "No specific review reason provided.")
    .pipe(z.string().min(1)),
  document_language: z.enum(["en", "es", "ur", "other", "unclear"]),
  confidence: z.number().min(0).max(1),
});

/**
 * Stage 2 — Candidate Extraction
 *
 * Pulls every concrete fact (deadlines, actions, risks, contacts) out of
 * the document, plus a list of questions the document leaves unanswered.
 */
export const Stage2Schema = z.object({
  deadlines: z.array(
    z.object({
      text: z.string().min(1),
      normalized_date: z.string().nullable().optional(),
      relative_time: z.string().nullable().optional(),
      evidence: z.string().min(1),
      section_id: z.string().nullable().optional(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  actions: z.array(
    z.object({
      text: z.string().min(1),
      evidence: z.string().min(1),
      section_id: z.string().nullable().optional(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  risks: z.array(
    z.object({
      text: z.string().min(1),
      evidence: z.string().min(1),
      section_id: z.string().nullable().optional(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  contacts: z.array(
    z.object({
      name: z.string().min(1),
      value: z.string().min(1),
      type: z.enum(["email", "phone", "office", "website", "other"]),
      evidence: z.string().min(1),
      confidence: z.number().min(0).max(1),
    }),
  ),
  missing_info: z.array(
    z.object({
      question: z.string().min(1),
      reason: z.string().min(1),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

/**
 * Stage 3 — Grounding & Verification
 *
 * Cross-references the extracted items against official source snippets
 * (or the document text when no snippets are available) and tags each
 * item as verified / partially_verified / unverified / conflicting.
 */
export const Stage3Schema = z.object({
  verified_items: z.array(
    z.object({
      item_type: z.enum(["deadline", "action", "risk", "contact"]),
      item_text: z.string().min(1),
      status: z.enum([
        "verified",
        "partially_verified",
        "unverified",
        "conflicting",
      ]),
      verification_basis: z.enum(["document", "official_source", "both"]),
      evidence: z.array(z.string().min(1)),
      confidence: z.number().min(0).max(1),
    }),
  ),
  verification_notes: z.array(
    z.object({
      note: z.string().min(1),
      severity: z.enum(["low", "medium", "high"]),
    }),
  ),
  needs_human_review: z.boolean(),
  human_review_reason: z
    .string()
    .transform(
      (v) => v.trim() || "No specific verification concern identified.",
    )
    .pipe(z.string().min(1)),
  overall_confidence: z.number().min(0).max(1),
});

/**
 * Stage 4 — User-Facing Synthesis
 *
 * Produces the actual user-facing output: plain-language summary,
 * action items, key deadlines, suggested questions, confidence breakdown,
 * and trusted official sources. The human_review flag is set when any
 * decision still needs an expert in the loop.
 */
export const Stage4Schema = z.object({
  ai_summary: z.string().min(1),
  action_items: z.array(
    z.object({
      text: z.string().min(1),
      priority: z.enum(["high", "medium", "low"]),
      supporting_evidence: z.string().min(1),
      completed: z.boolean(),
    }),
  ),
  key_deadlines: z.array(
    z.object({
      text: z.string().min(1),
      meaning: z.string().min(1),
      priority: z.enum(["high", "medium", "low"]),
      supporting_evidence: z.string().min(1),
    }),
  ),
  questions_to_ask: z.array(z.string().min(1)),
  ai_confidence: z.object({
    overall: z.number().min(0).max(1),
    summary: z.number().min(0).max(1),
    actions: z.number().min(0).max(1),
    deadlines: z.number().min(0).max(1),
    questions: z.number().min(0).max(1),
  }),
  trusted_sources: z.array(
    z.object({
      title: z.string().min(1),
      url: z.string().min(1),
      why_it_matters: z.string().min(1),
    }),
  ),
  needs_human_review: z.boolean(),
  human_review_reason: z
    .string()
    .transform((v) => v.trim() || "No specific synthesis concern identified.")
    .pipe(z.string().min(1)),
});

/**
 * Stage 5 — Safety Review
 *
 * Flags unsupported claims, overconfidence, conflicts, missing human
 * review, and unsafe recommendations. The transformer at the top of
 * the schema tolerates the LLM returning `"true"` / `"false"` strings
 * for the `pass` field (Groq sometimes does that) and normalizes them
 * to booleans. The `issues` array is forgiving: unknown issue types
 * are coerced to `missing_review` so the rest of the run still proceeds.
 */
export const Stage5Schema = z.object({
  pass: z
    .union([z.boolean(), z.string()])
    .transform((v) => {
      if (typeof v === "boolean") return v;
      return v.toLowerCase().startsWith("true");
    })
    .pipe(z.boolean())
    .catch(false),
  issues: z
    .array(
      z.object({
        type: z
          .string()
          .transform((v) => {
            const map: Record<string, string> = {
              unsupported_claim: "unsupported_claim",
              overconfidence: "overconfidence",
              conflict: "conflict",
              missing_review: "missing_review",
              unsafe_recommendation: "unsafe_recommendation",
            };
            return map[v] ?? "missing_review";
          })
          .pipe(
            z.enum([
              "unsupported_claim",
              "overconfidence",
              "conflict",
              "missing_review",
              "unsafe_recommendation",
            ]),
          ),
        severity: z.enum(["low", "medium", "high"]).catch("medium"),
        description: z
          .string()
          .transform((v) => v.trim() || "Issue flagged by safety reviewer.")
          .pipe(z.string().min(1)),
      }),
    )
    .catch([]),
  final_recommendation: z
    .string()
    .transform((v) => {
      // Strip parenthetical suffixes like "approve (no issues)"
      const normalized = v.trim().toLowerCase().split(/[\s(]/)[0];
      if (
        normalized === "approve" ||
        normalized === "revise" ||
        normalized === "block"
      ) {
        return normalized;
      }
      return "revise";
    })
    .pipe(z.enum(["approve", "revise", "block"]))
    .catch("revise"),
});

export type Stage1 = z.infer<typeof Stage1Schema>;
export type Stage2 = z.infer<typeof Stage2Schema>;
export type Stage3 = z.infer<typeof Stage3Schema>;
export type Stage4 = z.infer<typeof Stage4Schema>;
export type Stage5 = z.infer<typeof Stage5Schema>;
