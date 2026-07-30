import { createDocumentAnalysisWorker } from "./documentAnalysisWorker";

createDocumentAnalysisWorker();

// Keep the process alive under BullMQ.
process.stdin.resume();
