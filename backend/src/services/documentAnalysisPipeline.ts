import { z } from "zod";
import { getGroqClient, getGroqModel } from "../lib/llm/groqClient";
import {
  isTrustedOfficialUrl,
  searchOfficialSources,
  type OfficialSourceSnippet
} from "./officialSourceSearch";
import type {
  DocumentAnalysisPipelineResult,
  NormalizedDocument
} from "../types/documentAnalysis";

export const CLEARPATH_PIPELINE_VERSION = "2026-06-17";

const Stage1Schema = z.object({
  document_type: z.enum(["notice", "letter", "form", "email", "policy", "instruction", "other"]),
  primary_topic: z.string().min(1),
  intended_audience: z.enum(["student", "parent", "caregiver", "community_member", "other", "unclear"]),
  is_support_related: z.boolean(),
  possible_user_problem: z.string().min(1),
  contains_deadlines: z.boolean(),
  contains_actions: z.boolean(),
  contains_risks: z.boolean(),
  needs_human_review: z.boolean(),
  human_review_reason: z.string().min(1),
  document_language: z.enum(["en", "es", "ur", "other", "unclear"]),
  confidence: z.number().min(0).max(1)
});

const Stage2Schema = z.object({
  deadlines: z.array(z.object({
    text: z.string().min(1),
    normalized_date: z.string().nullable().optional(),
    relative_time: z.string().nullable().optional(),
    evidence: z.string().min(1),
    section_id: z.string().nullable().optional(),
    confidence: z.number().min(0).max(1)
  })),
  actions: z.array(z.object({
    text: z.string().min(1),
    evidence: z.string().min(1),
    section_id: z.string().nullable().optional(),
    confidence: z.number().min(0).max(1)
  })),
  risks: z.array(z.object({
    text: z.string().min(1),
    evidence: z.string().min(1),
    section_id: z.string().nullable().optional(),
    confidence: z.number().min(0).max(1)
  })),
  contacts: z.array(z.object({
    name: z.string().min(1),
    value: z.string().min(1),
    type: z.enum(["email", "phone", "office", "website", "other"]),
    evidence: z.string().min(1),
    confidence: z.number().min(0).max(1)
  })),
  missing_info: z.array(z.object({
    question: z.string().min(1),
    reason: z.string().min(1),
    confidence: z.number().min(0).max(1)
  }))
});

const Stage3Schema = z.object({
  verified_items: z.array(z.object({
    item_type: z.enum(["deadline", "action", "risk", "contact"]),
    item_text: z.string().min(1),
    status: z.enum(["verified", "partially_verified", "unverified", "conflicting"]),
    verification_basis: z.enum(["document", "official_source", "both"]),
    evidence: z.array(z.string().min(1)),
    confidence: z.number().min(0).max(1)
  })),
  verification_notes: z.array(z.object({
    note: z.string().min(1),
    severity: z.enum(["low", "medium", "high"])
  })),
  needs_human_review: z.boolean(),
  human_review_reason: z.string().min(1),
  overall_confidence: z.number().min(0).max(1)
});

const Stage4Schema = z.object({
  ai_summary: z.string().min(1),
  action_items: z.array(z.object({
    text: z.string().min(1),
    priority: z.enum(["high", "medium", "low"]),
    supporting_evidence: z.string().min(1)
  })),
  key_deadlines: z.array(z.object({
    text: z.string().min(1),
    meaning: z.string().min(1),
    priority: z.enum(["high", "medium", "low"]),
    supporting_evidence: z.string().min(1)
  })),
  questions_to_ask: z.array(z.string().min(1)),
  ai_confidence: z.object({
    overall: z.number().min(0).max(1),
    summary: z.number().min(0).max(1),
    actions: z.number().min(0).max(1),
    deadlines: z.number().min(0).max(1),
    questions: z.number().min(0).max(1)
  }),
  trusted_sources: z.array(z.object({
    title: z.string().min(1),
    url: z.string().min(1),
    why_it_matters: z.string().min(1)
  })),
  needs_human_review: z.boolean(),
  human_review_reason: z.string().min(1)
});

const Stage5Schema = z.object({
  pass: z.boolean(),
  issues: z.array(z.object({
    type: z.enum(["unsupported_claim", "overconfidence", "conflict", "missing_review", "unsafe_recommendation"]),
    severity: z.enum(["low", "medium", "high"]),
    description: z.string().min(1)
  })),
  final_recommendation: z.enum(["approve", "revise", "block"])
});

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

interface GuardrailDiagnostics {
  high_stakes_document: boolean;
  official_source_count: number;
  missing_verification: boolean;
  issue_notes: string[];
}

interface PipelineOptions {
  officialDomains?: string[];
  maxSearchResultsPerQuery?: number;
}

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json|jsonc|javascript|ts|typescript)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function extractJsonSlice(text: string): string {
  const cleaned = stripCodeFences(text);
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  const start =
    firstBrace === -1 ? firstBracket : firstBracket === -1 ? firstBrace : Math.min(firstBrace, firstBracket);
  return start >= 0 ? cleaned.slice(start) : cleaned;
}

function parseModelJson(input: string): unknown {
  return JSON.parse(extractJsonSlice(input));
}

async function askGroqJson<T>(
  messages: ChatMessage[],
  schema: z.ZodType<T>,
  temperature = 0
): Promise<T> {
  const client = getGroqClient();
  const model = getGroqModel();

  const completion = await client.chat.completions.create({
    model,
    temperature,
    messages
  });

  const content = completion.choices[0]?.message?.content ?? "";
  const parsed = parseModelJson(content);
  return schema.parse(parsed);
}

function buildSourceText(document: NormalizedDocument): string {
  const sections = (document.sections ?? [])
    .map((section) => [section.title, section.content].filter(Boolean).join("\n"))
    .filter(Boolean);

  const body = [document.source_text, ...sections]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");

  return body.trim();
}

function isHighStakesDocument(document: NormalizedDocument): boolean {
  const text = buildSourceText(document).toLowerCase();
  const keywords = [
    "eligibility",
    "qualified",
    "qualifies",
    "appeal",
    "medical",
    "diagnosis",
    "prescription",
    "legal",
    "law",
    "lawsuit",
    "eviction",
    "benefit",
    "insurance",
    "deadline extension",
    "can the deadline be extended",
    "disability",
    "accommodation"
  ];
  return keywords.some((keyword) => text.includes(keyword));
}

function summarizeGuardrailDiagnostics(
  stage1: z.infer<typeof Stage1Schema>,
  stage2: z.infer<typeof Stage2Schema>,
  stage3: z.infer<typeof Stage3Schema>,
  officialSnippets: OfficialSourceSnippet[],
  document: NormalizedDocument
): GuardrailDiagnostics {
  const issueNotes: string[] = [];
  const highStakesDocument = isHighStakesDocument(document);

  if (highStakesDocument) {
    issueNotes.push("High-stakes wording detected; human approval stays in the loop.");
  }

  if (officialSnippets.length === 0) {
    issueNotes.push("No official source snippets were available; verification falls back to document text only.");
  }

  const anyUnverified = stage3.verified_items.some((item) =>
    item.status === "unverified" || item.status === "conflicting"
  );

  if (anyUnverified) {
    issueNotes.push("One or more extracted claims could not be fully verified.");
  }

  if (stage1.needs_human_review) {
    issueNotes.push(`Stage 1 review signal: ${stage1.human_review_reason}`);
  }

  const missingCriticalInfo = stage2.missing_info.length > 0;
  if (missingCriticalInfo) {
    issueNotes.push("The document is missing critical context needed for a final answer.");
  }

  return {
    high_stakes_document: highStakesDocument,
    official_source_count: officialSnippets.length,
    missing_verification: anyUnverified || officialSnippets.length === 0,
    issue_notes: issueNotes
  };
}

function enforceUncertaintyLanguage(text: string, reviewRequired: boolean, reason: string): string {
  if (!reviewRequired) return text;
  const lower = text.toLowerCase();
  const markers = ["uncertain", "needs review", "not enough information"];
  if (markers.some((marker) => lower.includes(marker))) return text;
  return `needs review: ${text.trim()}`.trim();
}

function normalizeQuestions(questions: string[], reviewRequired: boolean, reason: string): string[] {
  if (!reviewRequired || questions.length === 0) return questions;
  const hasMarker = questions.some((q) =>
    /uncertain|needs review|not enough information/i.test(q)
  );
  if (hasMarker) return questions;
  return [`needs review: ${reason}`, ...questions];
}

function sanitizeTrustedSources(
  sources: z.infer<typeof Stage4Schema>["trusted_sources"],
  officialSnippets: OfficialSourceSnippet[]
): z.infer<typeof Stage4Schema>["trusted_sources"] {
  const allowedUrls = new Set(officialSnippets.map((snippet) => snippet.url));
  const filtered = sources.filter((source) => allowedUrls.has(source.url) || isTrustedOfficialUrl(source.url));
  const seen = new Set<string>();
  const deduped: typeof filtered = [];
  for (const source of filtered) {
    if (seen.has(source.url)) continue;
    seen.add(source.url);
    deduped.push(source);
  }
  return deduped;
}

function buildStage1Prompt(document: NormalizedDocument): ChatMessage[] {
  const sourceText = buildSourceText(document);
  return [
    {
      role: "system",
      content:
        "You are ClearPath Document Analyst. Use only the provided document text. Do not invent facts. If something is unclear, mark it as unclear. Return strict JSON only."
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          task: "Stage 1 — Document Understanding",
          document_text: sourceText,
          output_shape: {
            document_type: "notice|letter|form|email|policy|instruction|other",
            primary_topic: "short label",
            intended_audience: "student|parent|caregiver|community_member|other|unclear",
            is_support_related: true,
            possible_user_problem: "one sentence",
            contains_deadlines: true,
            contains_actions: true,
            contains_risks: true,
            needs_human_review: true,
            human_review_reason: "short reason",
            document_language: "en|es|ur|other|unclear",
            confidence: 0
          }
        },
        null,
        2
      )
    }
  ];
}

function buildStage2Prompt(
  document: NormalizedDocument,
  stage1: z.infer<typeof Stage1Schema>
): ChatMessage[] {
  const sourceText = buildSourceText(document);
  return [
    {
      role: "system",
      content:
        "You are ClearPath Extractor. Extract only facts explicitly supported by the document. Do not interpret beyond the text. Do not summarize yet. Return strict JSON only."
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
                confidence: 0
              }
            ],
            actions: [{ text: "", evidence: "", section_id: null, confidence: 0 }],
            risks: [{ text: "", evidence: "", section_id: null, confidence: 0 }],
            contacts: [{ name: "", value: "", type: "office", evidence: "", confidence: 0 }],
            missing_info: [{ question: "", reason: "", confidence: 0 }]
          }
        },
        null,
        2
      )
    }
  ];
}

async function buildOfficialSourceSnippets(
  document: NormalizedDocument,
  stage1: z.infer<typeof Stage1Schema>,
  stage2: z.infer<typeof Stage2Schema>,
  options: PipelineOptions = {}
): Promise<OfficialSourceSnippet[]> {
  const queries = new Set<string>();
  const topic = stage1.primary_topic?.trim();
  const sourceText = buildSourceText(document);
  const firstSentence = sourceText.split(/[.?!]\s+/)[0]?.slice(0, 120)?.trim();

  if (topic) {
    queries.add(`${topic} official`);
  }

  if (firstSentence) {
    queries.add(`${firstSentence} official`);
  }

  for (const deadline of stage2.deadlines.slice(0, 2)) {
    queries.add(`${deadline.text} official`);
  }

  for (const action of stage2.actions.slice(0, 2)) {
    queries.add(`${action.text} official`);
  }

  const snippets: OfficialSourceSnippet[] = [];
  for (const query of queries) {
    try {
      const hits = await searchOfficialSources(query, {
        count: options.maxSearchResultsPerQuery ?? 5,
        officialDomains: options.officialDomains,
        language: document.language ?? "en"
      });
      snippets.push(...hits);
    } catch {
      // Search failures should not break the whole run.
    }
  }

  return snippets.slice(0, 8);
}

function buildStage3Prompt(
  document: NormalizedDocument,
  extracted: z.infer<typeof Stage2Schema>,
  officialSnippets: OfficialSourceSnippet[]
): ChatMessage[] {
  const sourceText = buildSourceText(document);

  return [
    {
      role: "system",
      content:
        "You are ClearPath Verifier. Do not add new facts. Mark each item as verified, partially_verified, unverified, or conflicting. If the official snippets are missing or unclear, rely only on the document text and say so clearly. Return strict JSON only."
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
                confidence: 0
              }
            ],
            verification_notes: [{ note: "", severity: "low|medium|high" }],
            needs_human_review: true,
            human_review_reason: "",
            overall_confidence: 0
          }
        },
        null,
        2
      )
    }
  ];
}

function buildStage4Prompt(
  verified: z.infer<typeof Stage3Schema>,
  document: NormalizedDocument
): ChatMessage[] {
  const sourceText = buildSourceText(document);

  return [
    {
      role: "system",
      content:
        "You are ClearPath Synthesizer. Use verified items only. Keep the summary short and clear. If something cannot be verified, label it clearly as uncertain, needs review, or not enough information. Return strict JSON only."
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
            source_text: sourceText
          },
          verified_items: verified,
          output_shape: {
            ai_summary: "2-4 sentences max",
            action_items: [{ text: "", priority: "high", supporting_evidence: "" }],
            key_deadlines: [{ text: "", meaning: "", priority: "high", supporting_evidence: "" }],
            questions_to_ask: [""],
            ai_confidence: { overall: 0, summary: 0, actions: 0, deadlines: 0, questions: 0 },
            trusted_sources: [{ title: "", url: "", why_it_matters: "" }],
            needs_human_review: true,
            human_review_reason: ""
          }
        },
        null,
        2
      )
    }
  ];
}

function buildStage5Prompt(document: NormalizedDocument, synthesized: z.infer<typeof Stage4Schema>): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are ClearPath Safety Reviewer. Review the synthesized output for invented facts, unsupported claims, overconfidence, missing uncertainty, legal/medical/eligibility overreach, and mismatched dates or contacts. Do not rewrite the response. Only flag problems. Return strict JSON only."
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          task: "Stage 5 — Safety Review",
          document_text: buildSourceText(document),
          synthesized_output: synthesized,
          output_shape: {
            pass: true,
            issues: [{ type: "unsupported_claim", severity: "low", description: "" }],
            final_recommendation: "approve|revise|block"
          }
        },
        null,
        2
      )
    }
  ];
}

function buildStage5Guardrails(
  stage3: z.infer<typeof Stage3Schema>,
  stage4: z.infer<typeof Stage4Schema>,
  officialSnippets: OfficialSourceSnippet[],
  document: NormalizedDocument
): z.infer<typeof Stage5Schema> {
  const issues: z.infer<typeof Stage5Schema>["issues"] = [];

  const hasConflicts = stage3.verified_items.some((item) => item.status === "conflicting");
  const hasUnverified = stage3.verified_items.some((item) => item.status === "unverified");
  const highStakes = isHighStakesDocument(document);
  const reviewMissing =
    stage4.needs_human_review &&
    !/uncertain|needs review|not enough information/i.test(stage4.human_review_reason);

  if (hasConflicts) {
    issues.push({
      type: "conflict",
      severity: "high",
      description: "At least one extracted item was marked conflicting."
    });
  }

  if (hasUnverified) {
    issues.push({
      type: "missing_review",
      severity: "medium",
      description: "At least one extracted item was not fully verified."
    });
  }

  if (highStakes) {
    issues.push({
      type: "unsafe_recommendation",
      severity: "high",
      description: "The document appears high-stakes; a human should make eligibility, appeal, medical, or legal decisions."
    });
  }

  if (officialSnippets.length === 0) {
    issues.push({
      type: "missing_review",
      severity: "medium",
      description: "No official source snippets were available, so verification depends only on the uploaded text."
    });
  }

  if (reviewMissing) {
    issues.push({
      type: "missing_review",
      severity: "medium",
      description: "Human review is required, but the reason does not clearly state the uncertainty."
    });
  }

  if (stage4.trusted_sources.length === 0 && (highStakes || hasUnverified || officialSnippets.length === 0)) {
    issues.push({
      type: "missing_review",
      severity: "medium",
      description: "No trusted sources were retained for a document that needs verification."
    });
  }

  const finalRecommendation =
    issues.some((issue) => issue.severity === "high") ? "revise" : "approve";

  return {
    pass: finalRecommendation === "approve",
    issues,
    final_recommendation: finalRecommendation
  };
}

function mergeHumanReviewReason(
  stage1: z.infer<typeof Stage1Schema>,
  stage3: z.infer<typeof Stage3Schema>,
  stage4: z.infer<typeof Stage4Schema>,
  stage5: z.infer<typeof Stage5Schema>,
  guardrails: GuardrailDiagnostics
): string {
  const parts = [
    stage4.human_review_reason,
    stage3.human_review_reason,
    stage1.human_review_reason,
    ...guardrails.issue_notes,
    stage5.issues.map((issue) => issue.description).join(" ")
  ]
    .map((part) => part.trim())
    .filter(Boolean);

  const reason = parts[0] ?? "Needs human review.";
  return enforceUncertaintyLanguage(reason, true, reason);
}

export async function runClearPathPipeline(
  document: NormalizedDocument,
  options: PipelineOptions = {}
): Promise<DocumentAnalysisPipelineResult> {
  const stage1 = await askGroqJson(buildStage1Prompt(document), Stage1Schema, 0);
  const stage2 = await askGroqJson(buildStage2Prompt(document, stage1), Stage2Schema, 0);

  const officialSnippets = await buildOfficialSourceSnippets(document, stage1, stage2, options);

  const stage3 = await askGroqJson(
    buildStage3Prompt(document, stage2, officialSnippets),
    Stage3Schema,
    0
  );

  const stage4Raw = await askGroqJson(buildStage4Prompt(stage3, document), Stage4Schema, 0.15);
  const stage5Raw = await askGroqJson(buildStage5Prompt(document, stage4Raw), Stage5Schema, 0);

  const guardrails = buildStage5Guardrails(stage3, stage4Raw, officialSnippets, document);
  const stage5 = {
    ...stage5Raw,
    issues: [...stage5Raw.issues, ...guardrails.issues],
    final_recommendation:
      stage5Raw.final_recommendation === "block"
        ? "block"
        : guardrails.final_recommendation === "approve" && stage5Raw.final_recommendation === "approve"
          ? "approve"
          : "revise"
  } as z.infer<typeof Stage5Schema>;

  const humanReviewRequired =
    stage1.needs_human_review ||
    stage3.needs_human_review ||
    stage4Raw.needs_human_review ||
    stage5.final_recommendation !== "approve";

  const humanReviewReason = mergeHumanReviewReason(stage1, stage3, stage4Raw, stage5, {
    high_stakes_document: guardrails.issues.some((issue) => issue.type === "unsafe_recommendation"),
    official_source_count: officialSnippets.length,
    missing_verification: guardrails.issues.some((issue) => issue.type === "missing_review"),
    issue_notes: guardrails.issues.map((issue) => issue.description)
  });

  const trustedSources = sanitizeTrustedSources(stage4Raw.trusted_sources, officialSnippets);
  const summary = enforceUncertaintyLanguage(stage4Raw.ai_summary, humanReviewRequired, humanReviewReason);
  const questions = normalizeQuestions(stage4Raw.questions_to_ask, humanReviewRequired, humanReviewReason);

  return {
    summary,
    action_items: stage4Raw.action_items,
    key_deadlines: stage4Raw.key_deadlines,
    questions_to_ask: questions,
    ai_confidence: stage4Raw.ai_confidence,
    trusted_sources: trustedSources,
    human_review: {
      required: humanReviewRequired,
      reason: humanReviewReason
    },
    stage_outputs: {
      stage1,
      stage2,
      stage3,
      stage4: {
        ...stage4Raw,
        ai_summary: summary,
        questions_to_ask: questions,
        trusted_sources: trustedSources,
        needs_human_review: humanReviewRequired,
        human_review_reason: humanReviewReason
      },
      stage5,
      guardrails: {
        ...guardrails,
        official_source_count: officialSnippets.length
      }
    },
    status: humanReviewRequired ? "review_required" : "completed"
  };
}
