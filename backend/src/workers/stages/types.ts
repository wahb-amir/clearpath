import type { Job } from "bullmq";
import type { AnalysisJobData, DocumentRow } from "../../types/dtos";
import type { AnalysisStatus } from "../../types/pipelineStatus";
import { buildDocumentStructure } from "../../services/ingestion/buildStructure";
import { extractFacts } from "../../services/ingestion/extractFacts";
import { estimateQuality } from "../../services/ingestion/estimateQuality";

export interface AnalysisState {
  job: Job<AnalysisJobData>;
  doc: DocumentRow;
  workerId: string;
  currentStatus: AnalysisStatus;
  
  // Extracted values
  rawText?: string;
  extractionMethod?: "embedded" | "ocr" | "plain_text";
  ocrConfidence?: number;
  textCoverage?: number;
  usedOcrFallback?: boolean;
  
  // Cleaned values
  cleanText?: string;

  // Verification/Structured values
  sections?: ReturnType<typeof buildDocumentStructure>;
  facts?: ReturnType<typeof extractFacts>;
  quality?: ReturnType<typeof estimateQuality>;
  title?: string;
  summary?: string;
}
