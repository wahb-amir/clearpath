/**
 * Cross-cutting type aliases for the document analysis pipeline.
 *
 * These types are shared across every stage module so the pipeline can
 * stay cohesive without a central barrel file. Keep this file free of
 * runtime imports — it's a pure type module.
 */

export type PipelineEventEmitter = (input: {
  documentId: string;
  userId: string;
  eventType: string;
  stage: string;
  message: string;
  progress?: number;
  payload?: Record<string, unknown>;
}) => Promise<void>;

export interface PipelineOptions {
  officialDomains?: string[];
  maxSearchResultsPerQuery?: number;
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export interface GuardrailDiagnostics {
  high_stakes_document: boolean;
  official_source_count: number;
  missing_verification: boolean;
  issue_notes: string[];
}
