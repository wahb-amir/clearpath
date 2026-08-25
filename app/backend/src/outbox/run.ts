/**
 * Standalone entry point for the outbox dispatcher process.
 * Run separately from the API server and worker, e.g.:
 *   pnpm run dispatcher  ->  tsx src/outbox/run.ts
 */
import { outboxDispatcher } from "./dispatcher";

// Don't let an unhandled rejection from the LISTEN setup (or a
// transient Postgres outage) kill the dispatcher process. On a HF
// Space the polling fallback is enough to keep the pipeline moving
// even when LISTEN/NOTIFY is unavailable; the process must stay up.
process.on("unhandledRejection", (err) => {
  // eslint-disable-next-line no-console
  console.error("[outbox] unhandledRejection (kept alive)", err);
});

outboxDispatcher.start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(
    "[outbox] start() failed; will keep retrying via polling",
    err,
  );
});

process.on("SIGTERM", async () => {
  await outboxDispatcher.stop();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await outboxDispatcher.stop();
  process.exit(0);
});
