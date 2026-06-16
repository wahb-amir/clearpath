import { ConnectionOptions, Worker, type Job } from 'bullmq';
import { createWorkerConnection } from '../redis/connection';
import { env } from '../config/env';
import { pgPool, withTransaction } from '../db/pool';
import { supabase } from '../lib/supabase'; // existing Supabase client (Storage)
import type { AnalysisJobData, DocumentRow } from '../types/dtos';
import type { AnalysisStatus } from '../types/pipelineStatus';
import { isStageCompleteOrPast } from '../types/pipelineStatus';
import { reportStage, reportProgress, reportFailure } from './stageReporter';
import { detectFileCategory } from './stages/detectFileType';
import { extractText } from '../services/ingestion/extractText';
import { cleanExtractedText } from '../services/ingestion/cleanText';
import { detectLanguage } from '../services/ingestion/detectLanguage';
import { buildDocumentStructure } from '../services/ingestion/buildStructure';
import { extractFacts } from '../services/ingestion/extractFacts';
import { estimateQuality } from '../services/ingestion/estimateQuality';
import { buildChunks } from '../services/ingestion/buildChunks';
import { generateSummary } from '../services/ingestion/generateSummary';
import {
  persistSections,
  persistChunks,
  persistFacts,
  clearDerivedRecords,
} from '../services/ingestion/persistence';


export function createAnalysisWorker(): Worker<AnalysisJobData> {
  const worker = new Worker<AnalysisJobData>(
    env.ANALYSIS_QUEUE_NAME,
    async (job: Job<AnalysisJobData>) => {
      await processAnalysisJob(job);
    },
    {
      connection: createWorkerConnection() as ConnectionOptions,
      concurrency: 2, // tune based on CPU (OCR + embeddings are CPU-bound)
      lockDuration: 10 * 60 * 1000, // 10 min - long-running OCR/embedding jobs
    },
  );

  worker.on('failed', (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[worker] job ${job?.id} failed:`, err);
  });

  // Prevent unhandled promise rejections in stage code from crashing
  // the process - BullMQ already surfaces these via the 'failed' event.
  process.on('unhandledRejection', (reason) => {
    // eslint-disable-next-line no-console
    console.error('[worker] unhandled rejection:', reason);
  });

  return worker;
}

async function processAnalysisJob(job: Job<AnalysisJobData>): Promise<void> {
  const { documentId, analysisRequestId, userId, storagePath, mimeType, analysisVersion } =
    job.data;
  const workerId = env.WORKER_ID;

  // --- Idempotency guard: re-read current state ---
  const docResult = await pgPool.query<DocumentRow>(`SELECT * FROM documents WHERE id = $1`, [
    documentId,
  ]);
  if (docResult.rowCount === 0) {
    // Document was deleted - nothing to do, acknowledge job
    return;
  }
  const doc = docResult.rows[0];

  if (doc.analysis_status === 'COMPLETED') {
    // Duplicate job for an already-completed analysis - no-op
    return;
  }
  if (doc.analysis_status === 'CANCELLED') {
    return;
  }

  // Mark request as PROCESSING / started_at (idempotent: only set started_at once)
  await pgPool.query(
    `UPDATE document_analysis_requests
       SET status = 'PROCESSING', worker_id = $1, started_at = COALESCE(started_at, now())
     WHERE id = $2`,
    [workerId, analysisRequestId],
  );

  try {
    let currentStatus = doc.analysis_status as AnalysisStatus;

    // --- STAGE: PROCESSING / worker assigned ---
    if (!isStageCompleteOrPast(currentStatus, 'PROCESSING')) {
      await reportStage({
        documentId,
        userId,
        workerId,
        toStatus: 'PROCESSING',
        eventType: 'worker_assigned',
        message: `Worker ${workerId} picked up the job`,
        progress: 5,
      });
      currentStatus = 'PROCESSING';
    }

    // --- STAGE: EXTRACTING ---
    let rawText = '';
    let extractionMethod: 'embedded' | 'ocr' | 'plain_text' = 'plain_text';
    let ocrConfidence = 1;
    let textCoverage = 1;
    let usedOcrFallback = false;

    if (!isStageCompleteOrPast(currentStatus, 'EXTRACTING')) {
      await reportStage({
        documentId,
        userId,
        workerId,
        toStatus: 'EXTRACTING',
        eventType: 'extraction_started',
        message: 'Detecting file type and extracting text',
        progress: 10,
      });

      const fileBuffer = await downloadFromStorage(storagePath);
      const category = detectFileCategory(mimeType);

      const extraction = await extractText({
        fileBuffer,
        category,
        mimeType,
        onPageProgress: async (current, total) => {
          await reportProgress({
            documentId,
            userId,
            stage: 'EXTRACTING',
            eventType: 'extraction_progress',
            message: `Processed page ${current} of ${total}`,
            progress: 10 + Math.round((current / total) * 15),
            payload: { currentPage: current, totalPages: total },
          });
        },
      });

      rawText = extraction.rawText;
      extractionMethod = extraction.method;
      ocrConfidence = extraction.ocrConfidence;
      textCoverage = extraction.textCoverage;
      usedOcrFallback = extraction.usedOcrFallback;

      if (usedOcrFallback) {
        await reportProgress({
          documentId,
          userId,
          stage: 'EXTRACTING',
          eventType: 'ocr_fallback_started',
          message: 'Sparse embedded text detected - OCR fallback applied',
          progress: 25,
          payload: { ocrConfidence },
        });
      }

      currentStatus = 'EXTRACTING';

      // Persist rawText length / extraction metadata for observability
      // (full text is recomputed downstream; we don't persist rawText
      // itself per the note in the function docstring above)
      await pgPool.query(
        `UPDATE documents SET ocr_confidence = $1 WHERE id = $2`,
        [ocrConfidence, documentId],
      );
    } else {
      // Resuming past EXTRACTING without persisted rawText: re-extract.
      // (See docstring - acceptable cost tradeoff for v1.)
      const fileBuffer = await downloadFromStorage(storagePath);
      const category = detectFileCategory(mimeType);
      const extraction = await extractText({ fileBuffer, category, mimeType });
      rawText = extraction.rawText;
      extractionMethod = extraction.method;
      ocrConfidence = extraction.ocrConfidence;
      textCoverage = extraction.textCoverage;
    }

    // --- STAGE: CLEANING ---
    const cleanResult = cleanExtractedText(rawText, ocrConfidence);
    const cleanText = cleanResult.cleanText;

    if (!isStageCompleteOrPast(currentStatus, 'CLEANING')) {
      await reportStage({
        documentId,
        userId,
        workerId,
        toStatus: 'CLEANING',
        eventType: 'text_cleaned',
        message: 'Removed OCR noise and normalized whitespace',
        progress: 35,
        payload: { correctionsApplied: cleanResult.correctionsApplied },
      });

      // --- Language detection (emitted as part of CLEANING -> next transition) ---
      const language = detectLanguage(cleanText);
      await pgPool.query(`UPDATE documents SET language = $1 WHERE id = $2`, [
        language.code,
        documentId,
      ]);
      await reportProgress({
        documentId,
        userId,
        stage: 'CLEANING',
        eventType: 'language_detected',
        message: `Detected language: ${language.name}`,
        progress: 38,
        payload: { language: language.code, languageName: language.name },
      });

      currentStatus = 'CLEANING';
    }

    // --- STAGE: STRUCTURING ---
    const sections = buildDocumentStructure(cleanText);
    const facts = extractFacts(cleanText);
    const quality = estimateQuality({ ocrConfidence, textCoverage });

    if (!isStageCompleteOrPast(currentStatus, 'STRUCTURING')) {
      await reportStage({
        documentId,
        userId,
        workerId,
        toStatus: 'STRUCTURING',
        eventType: 'structure_preserved',
        message: 'Preserved document structure (sections, lists, tables)',
        progress: 45,
        payload: { sectionCount: countSections(sections), factCount: facts.length },
      });

      await pgPool.query(
        `UPDATE documents SET quality = $1 WHERE id = $2`,
        [quality.quality, documentId],
      );

      await reportProgress({
        documentId,
        userId,
        stage: 'STRUCTURING',
        eventType: 'entities_extracted',
        message: `Extracted ${facts.length} structured facts`,
        progress: 50,
        payload: { factCount: facts.length },
      });

      currentStatus = 'STRUCTURING';
    }

    // --- STAGE: CHUNKING + persistence of sections/chunks/facts ---
    const { title, summary } = generateSummary({ cleanText, sections });

    if (!isStageCompleteOrPast(currentStatus, 'CHUNKING')) {
      await reportStage({
        documentId,
        userId,
        workerId,
        toStatus: 'CHUNKING',
        eventType: 'chunking_completed',
        message: 'Built hierarchical chunks (document/section/paragraph/sentence)',
        progress: 60,
      });

      const chunks = buildChunks({ documentSummary: summary, sections });

      await withTransaction(async (client) => {
        // Idempotent re-run safety: clear any partial sections/chunks/facts
        // from a previous crashed attempt at this stage before re-inserting.
        await clearDerivedRecords(client, documentId);

        const sectionIdMap = await persistSections(client, documentId, sections);
        await persistFacts(client, documentId, facts);
        await persistChunks(client, documentId, chunks, sectionIdMap);
      });

      currentStatus = 'CHUNKING';
    }

    // --- STAGE: EMBEDDING ---
    // Embeddings are generated as part of persistChunks above (batch
    // call to bge-small-en-v1.5). We report the EMBEDDING stage after
    // chunk+embedding persistence completes successfully.
    if (!isStageCompleteOrPast(currentStatus, 'EMBEDDING')) {
      await reportStage({
        documentId,
        userId,
        workerId,
        toStatus: 'EMBEDDING',
        eventType: 'embedding_completed',
        message: 'Generated embeddings for all chunks (bge-small-en-v1.5)',
        progress: 80,
      });
      currentStatus = 'EMBEDDING';
    }

    // --- STAGE: SUMMARIZING ---
    if (!isStageCompleteOrPast(currentStatus, 'SUMMARIZING')) {
      await reportStage({
        documentId,
        userId,
        workerId,
        toStatus: 'SUMMARIZING',
        eventType: 'summary_created',
        message: 'Generated document summary',
        progress: 90,
        payload: { title, summary },
      });
      currentStatus = 'SUMMARIZING';
    }

    // --- STAGE: COMPLETED ---
    const processingSummary = {
      title,
      language: doc.language ?? detectLanguage(cleanText).name,
      ocrConfidence,
      quality: quality.quality,
      extractionMethod,
      dates: facts.filter((f) => f.factType === 'date' || f.factType === 'deadline'),
      contacts: facts.filter((f) => f.factType === 'email' || f.factType === 'phone'),
      sections: sections.map((s) => s.title).filter(Boolean),
      facts: facts.length,
      summary,
    };

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE documents
           SET analysis_status = 'COMPLETED', current_stage = 'COMPLETED', worker_id = $1
         WHERE id = $2`,
        [workerId, documentId],
      );
      await client.query(
        `UPDATE document_analysis_requests
           SET status = 'COMPLETED', finished_at = now()
         WHERE id = $1`,
        [analysisRequestId],
      );
      const { insertPipelineEvent } = await import('../services/analysisRequestService');
      await insertPipelineEvent(client, {
        documentId,
        userId,
        eventType: 'analysis_completed',
        stage: 'COMPLETED',
        message: 'Analysis completed',
        progress: 100,
        payload: processingSummary,
      });
    });

    // Best-effort live notify for the completion event
    await reportProgress({
      documentId,
      userId,
      stage: 'COMPLETED',
      eventType: 'analysis_completed',
      message: 'Analysis completed',
      progress: 100,
      payload: { analysisVersion },
    });
  } catch (err) {
    await reportFailure({ documentId, analysisRequestId, userId, workerId, error: err });
    throw err; // re-throw so BullMQ records the failure / applies retry+backoff
  }
}

function countSections(sections: ReturnType<typeof buildDocumentStructure>): number {
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

/** Downloads the uploaded file from Supabase Storage. */
async function downloadFromStorage(storagePath: string): Promise<Buffer> {
  // Adjust bucket name to match your Supabase Storage configuration.
  const BUCKET = 'documents';
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error || !data) {
    throw new Error(`Failed to download ${storagePath} from storage: ${error?.message}`);
  }
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
