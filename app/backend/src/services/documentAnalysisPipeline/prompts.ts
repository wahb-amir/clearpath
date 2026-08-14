import type { NormalizedDocument } from "../../types/documentAnalysis";
import type { OfficialSourceSnippet } from "../officialSourceSearch";
import type { ChatMessage } from "./types";
import type { Stage1, Stage2, Stage3, Stage4 } from "./schemas";

/**
 * Return the document's flattened source text (already a concatenation of
 * section titles + content + extracted facts, built by
 * `loadNormalizedDocument` / `buildSourceTextFromRows`).
 *
 * This is the canonical text that every stage prompt reads. We do not
 * re-append `document.sections` here — that used to duplicate the body
 * inside every prompt.
 */
export function buildSourceText(document: NormalizedDocument): string {
  return (document.source_text ?? "").trim();
}

/**
 * Stage 1 — Document Understanding prompt.
 * Tells the LLM what role to play, the rules to follow, and the
 * required output shape. Asks for type, topic, audience, and an
 * initial human-review flag.
 */
export function buildStage1Prompt(document: NormalizedDocument): ChatMessage[] {
  const sourceText = buildSourceText(document);
  return [
    {
      role: "system",
      content: `You are ClearPath Document Analyst — a specialist in helping immigrants, refugees, and underserved communities understand complex official documents.

RULES (follow strictly):
1. Read only the provided document text. Never invent, assume, or extrapolate beyond it.
2. If a field is genuinely unclear, set it to "unclear" or "other" — do not guess.
3. needs_human_review must be true if the document involves: legal rights, appeal processes, benefit eligibility, medical/health information, immigration status, evictions, financial penalties, or any high-stakes decision.
4. possible_user_problem should describe the REAL concern a non-expert reader would have (e.g. "Will my child be removed from school?" not "Document discusses enrollment").
5. Return ONLY strict JSON — no prose, no markdown, no explanation.`,
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          task: "Stage 1 — Document Understanding",
          document_text: sourceText,
          instructions:
            "Analyze the document and return the JSON object below. Every field is required.",
          output_shape: {
            document_type: [
              "notice",
              "letter",
              "form",
              "email",
              "policy",
              "instruction",
              "other",
            ],
            primary_topic:
              "3-6 word plain-English label (e.g. 'School meal application deadline')",
            intended_audience: [
              "student",
              "parent",
              "caregiver",
              "community_member",
              "other",
              "unclear",
            ],
            is_support_related:
              "boolean — true if the document concerns benefits, programs, or assistance",
            possible_user_problem:
              "One plain sentence describing the main worry a reader might have (e.g. 'I might miss the deadline to keep my free lunch benefit')",
            contains_deadlines: "boolean",
            contains_actions: "boolean — true if the reader must DO something",
            contains_risks:
              "boolean — true if failing to act leads to a negative outcome",
            needs_human_review:
              "boolean — REQUIRED true for legal, medical, immigration, benefit-eligibility, or appeal content",
            human_review_reason:
              "REQUIRED non-empty string. One sentence explaining WHY a human expert should review this. If low-risk, write 'Low-risk document, standard AI review is sufficient'. Never leave this blank.",
            document_language: ["en", "es", "ur", "other", "unclear"],
            confidence:
              "number 0-1 reflecting how clearly you can understand this document",
          },
        },
        null,
        2,
      ),
    },
  ];
}

/**
 * Stage 2 — Candidate Extraction prompt.
 * Uses Stage 1's classification as context to extract concrete facts
 * (deadlines, actions, risks, contacts) and list anything the document
 * leaves unanswered.
 */
export function buildStage2Prompt(
  document: NormalizedDocument,
  stage1: Stage1,
): ChatMessage[] {
  const sourceText = buildSourceText(document);
  return [
    {
      role: "system",
      content:
        "You are ClearPath Extractor. Extract only facts explicitly supported by the document. Do not interpret beyond the text. Do not summarize yet. Return strict JSON only.",
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          task: "Stage 2 — Candidate Extraction",
          document_text: sourceText,
          stage1,
          output_shape: {
            deadlines: [
              {
                text: "",
                normalized_date: null,
                relative_time: null,
                evidence: "",
                section_id: null,
                confidence: 0,
              },
            ],
            actions: [
              { text: "", evidence: "", section_id: null, confidence: 0 },
            ],
            risks: [
              { text: "", evidence: "", section_id: null, confidence: 0 },
            ],
            contacts: [
              {
                name: "",
                value: "",
                type: "office",
                evidence: "",
                confidence: 0,
              },
            ],
            missing_info: [{ question: "", reason: "", confidence: 0 }],
          },
        },
        null,
        2,
      ),
    },
  ];
}

/**
 * Stage 3 — Grounding and Verification prompt.
 * Asks the LLM to cross-reference every Stage 2 item against the
 * official-source snippets (or, when no snippets exist, just the
 * document text) and tag each item as verified / partially_verified /
 * unverified / conflicting.
 */
export function buildStage3Prompt(
  document: NormalizedDocument,
  extracted: Stage2,
  officialSnippets: OfficialSourceSnippet[],
): ChatMessage[] {
  const sourceText = buildSourceText(document);

  return [
    {
      role: "system",
      content:
        "You are ClearPath Verifier. Do not add new facts. Mark each item as verified, partially_verified, unverified, or conflicting. If the official snippets are missing or unclear, rely only on the document text and say so clearly. Return strict JSON only.",
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          task: "Stage 3 — Grounding and Verification",
          document_text: sourceText,
          extracted_items: extracted,
          official_source_snippets: officialSnippets,
          output_shape: {
            verified_items: [
              {
                item_type: "deadline|action|risk|contact",
                item_text: "",
                status: "verified|partially_verified|unverified|conflicting",
                verification_basis: "document|official_source|both",
                evidence: [""],
                confidence: 0,
              },
            ],
            verification_notes: [
              {
                note: "Example: One or more deadlines could not be confirmed against official sources.",
                severity: "low|medium|high",
              },
            ],
            needs_human_review: true,
            human_review_reason:
              "REQUIRED non-empty string. Example: 'The attendance policy details require verification by a school official.' If human review is not needed, write: 'No significant concerns found; standard AI review is sufficient.'",
            overall_confidence: 0,
          },
        },
        null,
        2,
      ),
    },
  ];
}

/**
 * Stage 4 — User-Facing Synthesis prompt.
 * Produces the final user-facing output: plain-language summary,
 * action items, key deadlines, suggested questions, confidence breakdown,
 * and trusted sources. The audience is non-native English speakers with
 * potentially low literacy, so the system message enforces compassionate
 * plain language.
 */
export function buildStage4Prompt(
  verified: Stage3,
  document: NormalizedDocument,
  officialSnippets: OfficialSourceSnippet[],
): ChatMessage[] {
  const sourceText = buildSourceText(document);

  return [
    {
      role: "system",
      content: `You are ClearPath Synthesizer — you write the final user-facing output for immigrants, refugees, and underserved families reading complex documents.

AUDIENCE: Non-native English speakers. Possibly low literacy. May be stressed or scared.

YOUR RULES:
1. Use simple, clear, compassionate language. No bureaucratic jargon. No legal-speak.
2. ai_summary: 2-4 sentences max. Start with what the document IS (e.g. "This is a notice about...") then what the reader MUST DO (if anything) and by WHEN.
3. action_items: You MUST produce at least one action_item if the document contains any instruction, deadline, form, or required step. Start each with a verb ("Call the school office", "Sign and return the form"). Set completed=false on every item. Priority = "high" if missing this step causes a negative outcome (loss of benefit, legal consequence, etc.).
4. key_deadlines: Be specific. If the document says "by Friday October 4th", use that exact date as the "text". The "meaning" field explains WHY it matters (e.g. "You will lose your housing benefit if you miss this date").
5. questions_to_ask: Questions the reader should bring to a caseworker, school office, legal aid, or doctor. Write them as the reader would ask them ("Can I get more time if I need it?").
6. Only move an item to questions_to_ask INSTEAD of action_items when you have absolutely no document evidence for it. If any evidence exists in the document, put it in action_items with priority "medium" or "low".
7. trusted_sources: You MUST include every entry from official_source_snippets whose topic is relevant to this document. Copy the exact title and url from the snippet. Do not invent new URLs.
8. Return ONLY strict JSON — no markdown, no prose, no explanation.`,
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          task: "Stage 4 — User-Facing Synthesis",
          document_context: {
            document_id: document.document_id,
            user_id: document.user_id,
            file_type: document.file_type,
            language: document.language ?? null,
            source_text: sourceText,
          },
          official_source_snippets: officialSnippets,
          verified_items: verified,
          output_shape: {
            ai_summary:
              "2-4 sentences. Plain English. Start with what the document IS, then what to DO and by WHEN.",
            action_items: [
              {
                text: "Start with a verb. One clear action per item (e.g. 'Call the school attendance office at the number on the top of this letter')",
                priority: "high | medium | low  — high if missing causes harm",
                supporting_evidence:
                  "Direct quote or reference from the document that supports this action",
                completed: false,
              },
            ],
            key_deadlines: [
              {
                text: "The deadline as stated (e.g. 'October 4, 2025' or 'within 10 days of receiving this notice')",
                meaning: "Why this deadline matters and what happens if missed",
                priority: "high | medium | low",
                supporting_evidence:
                  "The exact sentence from the document that mentions this deadline",
              },
            ],
            questions_to_ask: [
              "Plain questions the reader should ask a human expert. Written as the reader would say them. Include at least one question about next steps and one about appeal/extension rights if relevant.",
            ],
            ai_confidence: {
              overall: "0-1 overall confidence",
              summary: "0-1 confidence in the summary",
              actions: "0-1 confidence in the action items",
              deadlines: "0-1 confidence in the deadlines",
              questions: "0-1 confidence in the suggested questions",
            },
            trusted_sources: [
              {
                title: "Title of the official source",
                url: "MUST come from official_source_snippets — do not invent URLs",
                why_it_matters:
                  "One sentence explaining how this source helps the reader",
              },
            ],
            needs_human_review:
              "boolean — true if ANY action item, deadline, or eligibility decision requires professional verification",
            human_review_reason:
              "REQUIRED non-empty string. One sentence explaining the specific concern that requires human review. If human review is not needed, write: 'No significant concerns; standard AI review is sufficient.'",
          },
        },
        null,
        2,
      ),
    },
  ];
}

/**
 * Stage 5 — Safety Review prompt.
 * Asks the LLM to flag unsupported claims, overconfidence, conflicts,
 * missing uncertainty, legal/medical/eligibility overreach, and
 * mismatched dates or contacts. The model must NOT rewrite the
 * response — it only flags problems.
 */
export function buildStage5Prompt(
  document: NormalizedDocument,
  synthesized: Stage4,
): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are ClearPath Safety Reviewer. Review the synthesized output for invented facts, unsupported claims, overconfidence, missing uncertainty, legal/medical/eligibility overreach, and mismatched dates or contacts. Do not rewrite the response. Only flag problems. Return strict JSON only.",
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          task: "Stage 5 — Safety Review",
          document_text: buildSourceText(document),
          synthesized_output: synthesized,
          output_shape: {
            pass: "boolean — true if no serious issues found, false if issues require revision or blocking",
            issues: [
              {
                type: "unsupported_claim|overconfidence|conflict|missing_review|unsafe_recommendation",
                severity: "low|medium|high",
                description:
                  "One sentence describing the specific issue found. Must not be empty.",
              },
            ],
            final_recommendation:
              "approve (no issues) | revise (minor issues) | block (serious issues)",
          },
          critical_rules: [
            "ALL THREE top-level fields (pass, issues, final_recommendation) are REQUIRED in your response.",
            "pass must be a boolean (true or false), not a string.",
            "final_recommendation must be exactly one of: approve, revise, or block.",
            "If there are no issues, return pass=true, issues=[], final_recommendation=approve.",
          ],
        },
        null,
        2,
      ),
    },
  ];
}
