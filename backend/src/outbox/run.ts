/**
 * Standalone entry point for the outbox dispatcher process.
 * Run separately from the API server and worker, e.g.:
 *   pnpm run dispatcher  ->  tsx src/outbox/run.ts
 */
import { outboxDispatcher } from "./dispatcher";

void outboxDispatcher.start();

process.on("SIGTERM", async () => {
  await outboxDispatcher.stop();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await outboxDispatcher.stop();
  process.exit(0);
});
