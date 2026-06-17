export type ReviewPriority = "high" | "medium" | "low";

export interface DocumentSectionNode {
  section_id: string;
  title?: string | null;
  content: string;
  parent_id?: string | null;
  order?: number | null;
}

export interface DocumentEntitySnapshot {
  dates?: string[];
  contacts?: string[];
  urls?: string[];
  names?: string[];
}

export interface NormalizedDocument {
  document_id: string;
  user_id: string;
  file_type: string;
  language?: string | null;
  source_text: string;
  sections?: DocumentSectionNode[];
  entities?: DocumentEntitySnapshot;
}

export interface ActionItem {
  text: string;
  priority: ReviewPriority;
}

export interface KeyDeadline {
  text: string;
  meaning: string;
  priority: ReviewPriority;
}

export interface TrustedSource {
  title: string;
  url: string;
}

export interface HumanReview {
  required: boolean;
  reason: string;
}

export interface AiConfidence {
  overall: number;
}

export interface FinalDocumentAnalysisResult {
  summary: string;
  action_items: ActionItem[];
  key_deadlines: KeyDeadline[];
  questions_to_ask: string[];
  ai_confidence: AiConfidence;
  trusted_sources: TrustedSource[];
  human_review: HumanReview;
}

export interface PipelineStageOutputs {
  stage1: unknown;
  stage2: unknown;
  stage3: unknown;
  stage4: unknown;
  stage5: unknown;
  guardrails: unknown;
}

export interface DocumentAnalysisPipelineResult extends FinalDocumentAnalysisResult {
  stage_outputs: PipelineStageOutputs;
  status: "completed" | "review_required";
}

export interface DocumentAnalysisJobData {
  analysisRequestId: string;
  documentId: string;
  userId: string;
  /**
   * Optional. The worker can rebuild the source text from sections/chunks,
   * but a caller may pass a pre-extracted document payload for testing.
   */
  sourceText?: string;
  fileType?: string;
  language?: string | null;
  storagePath?: string;
  mimeType?: string;
}
