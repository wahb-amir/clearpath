import { isStageCompleteOrPast } from "../../types/pipelineStatus";
import { reportStage, reportProgress } from "../stageReporter";
import { pgPool } from "../../db/pool";
import type { AnalysisState } from "./types";
import { buildDocumentStructure } from "../../services/ingestion/buildStructure";
import { extractFacts } from "../../services/ingestion/extractFacts";

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
  const { job, workerId, cleanText, quality } = state;
  let { currentStatus } = state;
  const { documentId, userId } = job.data;

  const sections = buildDocumentStructure(cleanText || "");
  const facts = extractFacts(cleanText || "");

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

    await pgPool.query(`UPDATE documents SET quality = $1 WHERE id = $2`, [
      quality?.quality,
      documentId,
    ]);

    await reportProgress({
      documentId,
      userId,
      stage: "STRUCTURING",
      eventType: "entities_extracted",
      message: `Extracted ${(facts || []).length} structured facts`,
      progress: 50,
      payload: { factCount: (facts || []).length },
    });

    currentStatus = "STRUCTURING";
  }

  return { ...state, currentStatus, sections, facts };
}
