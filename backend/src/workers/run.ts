/**
 * Standalone entry point for the BullMQ worker process.
 * Run separately from the API server and dispatcher, e.g.:
 *   pnpm run worker  ->  tsx src/workers/run.ts
 */
import { createAnalysisWorker } from './analysisWorker';

const worker = createAnalysisWorker();

console.log(`[worker] started (queue=document-analysis, workerId=${process.env.WORKER_ID})`);

process.on('SIGTERM', async () => {
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await worker.close();
  process.exit(0);
});
