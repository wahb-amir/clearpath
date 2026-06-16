/**
 * Standalone entry point for the outbox dispatcher process.
 * Run separately from the API server and worker, e.g.:
 *   npm run dispatcher  ->  ts-node src/outbox/run.ts
 *
 * Alternatively (small deployments), call outboxDispatcher.start()
 * from src/index.ts alongside the Express server - just ensure only
 * ONE instance runs the polling loop to avoid duplicate dispatch
 * attempts (harmless due to BullMQ jobId dedup + outbox status checks,
 * but wasteful).
 */
import { outboxDispatcher } from './dispatcher';

void outboxDispatcher.start();

process.on('SIGTERM', async () => {
  await outboxDispatcher.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await outboxDispatcher.stop();
  process.exit(0);
});
