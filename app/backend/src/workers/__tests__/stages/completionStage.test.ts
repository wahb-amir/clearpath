import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeState } from "../fixtures";

vi.mock("../../stageReporter", () => ({
  reportStage: vi.fn().mockResolvedValue(undefined),
}));

const mockWithTransaction = vi.fn(async (fn: any) => {
  const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
  return fn(client);
});

vi.mock("../../../db/pool", () => ({
  pgPool: { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) },
  withTransaction: (fn: any) => mockWithTransaction(fn),
}));

import { processCompletionStage } from "../../stages/completionStage";
import { reportStage } from "../../stageReporter";

describe("processCompletionStage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWithTransaction.mockImplementation(async (fn: any) => {
      const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
      return fn(client);
    });
  });

  it("reports PREPROCESSING_COMPLETED stage when not yet past it", async () => {
    const state = makeState({ status: "SUMMARIZING" });

    await processCompletionStage(state);

    expect(reportStage).toHaveBeenCalledWith(
      expect.objectContaining({
        toStatus: "PREPROCESSING_COMPLETED",
        eventType: "preprocessing_completed",
        progress: 95,
      }),
    );
  });

  it("inserts outbox event with correct payload in a transaction", async () => {
    const state = makeState({ status: "SUMMARIZING" });
    let insertedPayload: any;
    let insertedAggregateId: string | undefined;

    mockWithTransaction.mockImplementation(async (fn: any) => {
      const client = {
        query: vi
          .fn()
          .mockImplementation(async (sql: string, params: any[]) => {
            if (sql.includes("document_pipeline_outbox")) {
              insertedAggregateId = params[0];
              insertedPayload = JSON.parse(params[1]);
            }
            return { rows: [] };
          }),
      };
      return fn(client);
    });

    await processCompletionStage(state);

    expect(insertedAggregateId).toBe("req-456");
    expect(insertedPayload).toEqual({
      documentId: "doc-123",
      userId: "user-789",
      analysisRequestId: "req-456",
      analysisVersion: "v1",
    });
  });

  it("inserts outbox with event_type = 'document.preprocessing.completed'", async () => {
    const state = makeState({ status: "SUMMARIZING" });
    let capturedSql = "";

    mockWithTransaction.mockImplementation(async (fn: any) => {
      const client = {
        query: vi
          .fn()
          .mockImplementation(async (sql: string, _params: any[]) => {
            if (sql.includes("document_pipeline_outbox")) {
              capturedSql = sql;
            }
            return { rows: [] };
          }),
      };
      return fn(client);
    });

    await processCompletionStage(state);

    expect(capturedSql).toContain("document.preprocessing.completed");
  });

  it("skips all side-effects when already past PREPROCESSING_COMPLETED", async () => {
    const state = makeState({ status: "AI_QUEUED" });

    await processCompletionStage(state);

    expect(reportStage).not.toHaveBeenCalled();
    expect(mockWithTransaction).not.toHaveBeenCalled();
  });

  it("does not crash on a fresh document going through for the first time", async () => {
    const state = makeState({ status: "SUMMARIZING" });

    await expect(processCompletionStage(state)).resolves.toBeUndefined();
  });

  it("outbox insert uses aggregate_type = 'document_analysis_request'", async () => {
    const state = makeState({ status: "SUMMARIZING" });
    let capturedSql = "";

    mockWithTransaction.mockImplementation(async (fn: any) => {
      const client = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes("document_pipeline_outbox")) capturedSql = sql;
          return { rows: [] };
        }),
      };
      return fn(client);
    });

    await processCompletionStage(state);

    expect(capturedSql).toContain("document_analysis_request");
  });
});
