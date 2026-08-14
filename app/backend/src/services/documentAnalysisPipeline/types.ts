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
  /**
   * Hard cap on the number of web searches the model is allowed to run
   * during the grounding stage. Default: 3. The router model may
   * request fewer; this is the ceiling.
   */
  maxSearches?: number;
  /**
   * Default per-query result count for each Tavily search. The router
   * may override per-query. Default: 5.
   */
  maxSearchResultsPerQuery?: number;
  /**
   * Optional default site restriction (e.g. ['ca.gov']). When the
   * router decision has no per-query `sites` AND this is set, the
   * search will use this as a fallback scope. Most callers should
   * leave this undefined so the router is free to choose.
   */
  defaultSearchSites?: string[];
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
