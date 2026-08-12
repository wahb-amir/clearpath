import { isStageCompleteOrPast } from "../../types/pipelineStatus";
import { reportStage, reportProgress } from "../stageReporter";
import { pgPool, withTransaction } from "../../db/pool";
import { persistSections, persistFacts, clearDerivedRecords } from "../../services/ingestion/persistence";
import type { AnalysisState } from "./types";
import { buildDocumentStructure } from "../../services/ingestion/buildStructure";
import { extractFacts } from "../../services/ingestion/extractFacts";
import { estimateQuality } from "../../services/ingestion/estimateQuality";
import { detectLanguage } from "../../services/ingestion/detectLanguage";
import { supabase } from "../../lib/supabase";

function countSections(
  sections: ReturnType<typeof buildDocumentStructure>,
): number {
  let count = 0;
  const visit = (nodes: typeof sections) => {
    for (const n of nodes) {
      count += 1;
      visit(n.children);
    }
  };
  visit(sections);
  return count;
}

export async function processStructuringStage(
  state: AnalysisState,
): Promise<AnalysisState> {
  const { job, workerId, markdownContent, ocrConfidence = 1, textCoverage = 1 } = state;
  let { currentStatus } = state;
  const { documentId, userId } = job.data;

  const content = markdownContent || "";
  const sections = buildDocumentStructure(content);
  const facts = extractFacts(content);
  const quality = estimateQuality({ ocrConfidence, textCoverage });

  if (!isStageCompleteOrPast(currentStatus, "STRUCTURING")) {
    await reportStage({
      documentId,
      userId,
      workerId,
      toStatus: "STRUCTURING",
      eventType: "structure_preserved",
      message: "Preserved document structure (sections, lists, tables)",
      progress: 45,
      payload: {
        sectionCount: countSections(sections || []),
        factCount: (facts || []).length,
      },
    });

    const language = detectLanguage(content);

    await pgPool.query(
      `UPDATE documents SET quality = $1, language = $2 WHERE id = $3`,
      [quality.quality, language.code, documentId]
    );

    // After successfully downloading the markdown and persisting the sections/facts, we delete the original document file
    const docRes = await pgPool.query(`SELECT storage_path FROM documents WHERE id = $1`, [documentId]);
    const storagePath = docRes.rows[0]?.storage_path;
    if (storagePath) {
      const { error } = await supabase.storage.from("documents").remove([storagePath]);
      if (error) {
        console.warn(`[structuringStage] Failed to delete original document ${storagePath} from bucket:`, error);
      } else {
        await pgPool.query(`UPDATE documents SET storage_path = 'DELETED' WHERE id = $1`, [documentId]);
      }
    }

    await reportProgress({
      documentId,
      userId,
      stage: "STRUCTURING",
      eventType: "entities_extracted",
      message: `Extracted ${(facts || []).length} structured facts`,
      progress: 50,
      payload: { factCount: (facts || []).length },
    });

    await withTransaction(async (client) => {
      await clearDerivedRecords(client, documentId);
      await persistSections(client, documentId, sections || []);
      await persistFacts(client, documentId, facts || []);
    });

    currentStatus = "STRUCTURING";
  }

  return { ...state, currentStatus, sections, facts, quality };
}
