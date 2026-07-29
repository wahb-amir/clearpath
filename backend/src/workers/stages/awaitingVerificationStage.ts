import { isStageCompleteOrPast } from "../../types/pipelineStatus";
import { reportStage } from "../stageReporter";
import { buildDocumentStructure } from "../../services/ingestion/buildStructure";
import { extractFacts } from "../../services/ingestion/extractFacts";
import { estimateQuality } from "../../services/ingestion/estimateQuality";
import { generateSummary } from "../../services/ingestion/generateSummary";
import { detectLanguage } from "../../services/ingestion/detectLanguage";
import { withTransaction } from "../../db/pool";
import type { AnalysisState } from "./types";

export async function processAwaitingVerificationStage(
  state: AnalysisState,
): Promise<{ state: AnalysisState; halt: boolean }> {
  const {
    job,
    doc,
    workerId,
    cleanText,
    ocrConfidence,
    textCoverage,
    extractionMethod,
  } = state;
  const { currentStatus } = state;
  const { documentId, userId, analysisRequestId, analysisVersion } = job.data;

  let sections: ReturnType<typeof buildDocumentStructure>;
  let facts: ReturnType<typeof extractFacts>;
  let quality: ReturnType<typeof estimateQuality>;
  let title: string;
  let summary: string;

  if (!isStageCompleteOrPast(currentStatus, "AWAITING_VERIFICATION")) {
    sections = buildDocumentStructure(cleanText || "");
    facts = extractFacts(cleanText || "");
    quality = estimateQuality({
      ocrConfidence: ocrConfidence || 1,
      textCoverage: textCoverage || 1,
    });
    const generated = generateSummary({ cleanText: cleanText || "", sections });
    title = generated.title;
    summary = generated.summary;

    const extractedContent = {
      title,
      summary,
      language: doc.language ?? detectLanguage(cleanText || "").name,
      quality: quality.quality,
      ocrConfidence,
      extractionMethod,
      sections: sections.map((s, i) => ({
        index: i,
        title: s.title ?? `Section ${i + 1}`,
        content: [
          s.textContent ?? "",
          ...(s.children?.map((c) => c.textContent ?? "") ?? []),
        ]
          .filter(Boolean)
          .join("\n\n"),
      })),
      dates: facts
        .filter((f) => f.factType === "date" || f.factType === "deadline")
        .map((f) => ({
          value: f.value,
          normalizedValue: f.normalizedValue,
          factType: f.factType,
          context: f.context,
          confidence: f.confidence,
        })),
      contacts: facts
        .filter((f) => f.factType === "email" || f.factType === "phone")
        .map((f) => ({
          value: f.value,
          factType: f.factType,
          context: f.context,
          confidence: f.confidence,
        })),
      amounts: facts
        .filter((f) => f.factType === "amount")
        .map((f) => ({
          value: f.value,
          context: f.context,
          confidence: f.confidence,
        })),
      referenceIds: facts
        .filter((f) => f.factType === "reference_id")
        .map((f) => ({
          value: f.value,
          context: f.context,
          confidence: f.confidence,
        })),
      rawTextPreview: (cleanText || "").slice(0, 3000),
    };

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE documents
            SET extracted_content = $1::jsonb
          WHERE id = $2`,
        [JSON.stringify(extractedContent), documentId],
      );

      await client.query(
        `UPDATE document_analysis_requests
            SET status = 'PROCESSING'
          WHERE id = $1`,
        [analysisRequestId],
      );
    });

    await reportStage({
      documentId,
      userId,
      workerId,
      toStatus: "AWAITING_VERIFICATION",
      eventType: "extraction_awaiting_verification" as any,
      message:
        "Extraction complete — please verify and confirm the extracted content",
      progress: 40,
      payload: {
        extractedContent,
        analysisRequestId,
        _resumeMeta: { analysisRequestId, analysisVersion },
      },
    });

    return { state, halt: true };
  } else {
    const content = doc.extracted_content as any;
    title = content.title ?? "Untitled document";
    summary = content.summary ?? "";
    quality = {
      quality: content.quality ?? "unknown",
      ocrConfidence: content.ocrConfidence ?? doc.ocr_confidence ?? 1,
      textCoverage: content.textCoverage ?? 1,
    };

    facts = [];
    const addFact = (arr: any[], defaultType?: string) => {
      if (!arr) return;
      for (const item of arr) {
        facts.push({
          factType: (item.factType ?? defaultType) as any,
          value: item.value,
          normalizedValue: item.normalizedValue,
          context: item.context,
          confidence: item.confidence,
        });
      }
    };
    addFact(content.dates);
    addFact(content.contacts);
    addFact(content.amounts, "amount");
    addFact(content.referenceIds, "reference_id");

    sections = (content.sections || []).map((s: any) => ({
      title: s.title,
      level: 1,
      sectionType: "section",
      textContent: s.content,
      orderIndex: s.index,
      children: [],
    }));

    return {
      state: {
        ...state,
        title,
        summary,
        quality,
        facts,
        sections,
      },
      halt: false,
    };
  }
}
