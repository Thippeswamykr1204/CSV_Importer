import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BatchMappingOutcome } from "@/lib/services/ai-mapper.service";
import type { AiBatchItem } from "@/lib/validators/schemas";

const { mapAllBatchesMock } = vi.hoisted(() => ({ mapAllBatchesMock: vi.fn() }));

vi.mock("@/lib/services/ai-mapper.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/ai-mapper.service")>();
  return {
    ...actual,
    mapAllBatches: mapAllBatchesMock,
  };
});

import { runImportPipeline, type ImportProgressHandlers } from "@/lib/services/import.service";

function fakeItem(rowIndex: number, overrides: Partial<AiBatchItem> = {}): AiBatchItem {
  return {
    rowIndex,
    skip: false,
    skipReason: null,
    confidence: 0.8,
    record: {
      created_at: null,
      name: "Jane",
      email: "jane@x.com",
      country_code: null,
      mobile_without_country_code: null,
      company: null,
      city: null,
      state: null,
      country: null,
      lead_owner: null,
      crm_status: null,
      crm_note: null,
      data_source: null,
      possession_time: null,
      description: null,
    },
    warnings: [],
    ...overrides,
  };
}

function makeHandlers(): ImportProgressHandlers & {
  stages: { stage: string; message: string; progress: number }[];
  events: { batchIndex: number; totalBatches: number; status: string; recordsInBatch: number }[];
} {
  const stages: { stage: string; message: string; progress: number }[] = [];
  const events: { batchIndex: number; totalBatches: number; status: string; recordsInBatch: number }[] = [];
  return {
    stages,
    events,
    onStage: (stage, message, progress) => stages.push({ stage, message, progress }),
    onBatchEvent: (batchIndex, totalBatches, status, recordsInBatch) =>
      events.push({ batchIndex, totalBatches, status, recordsInBatch }),
  };
}

const HEADERS = ["Name", "Email"];
const ROWS = [
  { Name: "Jane", Email: "jane@x.com" },
  { Name: "Bad Row", Email: "" },
];

beforeEach(() => {
  mapAllBatchesMock.mockReset();
});

describe("runImportPipeline — happy path", () => {
  it("splits imported vs skipped records and computes stats", async () => {
    mapAllBatchesMock.mockImplementation(async (_headers, _batches, _concurrency, onBatchSettled) => {
      const outcome: BatchMappingOutcome = {
        batchIndex: 0,
        items: [fakeItem(0, { confidence: 1 }), fakeItem(1, { skip: true, skipReason: "no contact info" })],
        retries: 0,
        failed: false,
      };
      onBatchSettled(outcome);
      return [outcome];
    });

    const handlers = makeHandlers();
    const result = await runImportPipeline(HEADERS, ROWS, handlers);

    expect(result.imported).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.stats.totalRecords).toBe(2);
    expect(result.stats.importedRecords).toBe(1);
    expect(result.stats.skippedRecords).toBe(1);
    expect(result.stats.averageConfidence).toBe(1);
    expect(result.stats.batchesFailed).toBe(0);
    expect(result.stats.retriedBatches).toBe(0);
  });

  it("reports the final 'done' stage at 100% progress", async () => {
    mapAllBatchesMock.mockImplementation(async () => [
      { batchIndex: 0, items: [fakeItem(0)], retries: 0, failed: false } satisfies BatchMappingOutcome,
    ]);

    const handlers = makeHandlers();
    await runImportPipeline(HEADERS, [ROWS[0]], handlers);

    const last = handlers.stages[handlers.stages.length - 1];
    expect(last.stage).toBe("done");
    expect(last.progress).toBe(100);
  });

  it("keeps results sorted by original row index regardless of batch/completion order", async () => {
    mapAllBatchesMock.mockImplementation(async () => [
      { batchIndex: 1, items: [fakeItem(2), fakeItem(3)], retries: 0, failed: false } satisfies BatchMappingOutcome,
      { batchIndex: 0, items: [fakeItem(0), fakeItem(1)], retries: 0, failed: false } satisfies BatchMappingOutcome,
    ]);

    const handlers = makeHandlers();
    const rows = Array.from({ length: 4 }, () => ({ Name: "Jane", Email: "jane@x.com" }));
    const result = await runImportPipeline(HEADERS, rows, handlers);

    expect(result.imported.map((r) => r.rowIndex)).toEqual([0, 1, 2, 3]);
  });
});

describe("runImportPipeline — failed batches", () => {
  it("marks every row in a failed batch as skipped with the failure reason, never silently dropped", async () => {
    mapAllBatchesMock.mockImplementation(async (_headers, _batches, _concurrency, onBatchSettled) => {
      const outcome: BatchMappingOutcome = {
        batchIndex: 0,
        items: [],
        retries: 3,
        failed: true,
        errorMessage: "bad api key",
      };
      onBatchSettled(outcome);
      return [outcome];
    });

    const handlers = makeHandlers();
    const result = await runImportPipeline(HEADERS, ROWS, handlers);

    expect(result.imported).toHaveLength(0);
    expect(result.skipped).toHaveLength(2);
    expect(result.skipped.every((s) => s.reason.includes("AI batch failed after retries"))).toBe(true);
    expect(result.skipped.every((s) => s.reason.includes("bad api key"))).toBe(true);
    expect(result.stats.batchesFailed).toBe(1);
  });

  it("emits a 'failed' batch event for failed batches and 'completed' for successful ones", async () => {
    // 30 rows -> two batches at the default BATCH_SIZE of 25, so
    // batchIndex 0 and 1 both correspond to real batches.
    const rows = Array.from({ length: 30 }, () => ({ Name: "Jane", Email: "jane@x.com" }));

    mapAllBatchesMock.mockImplementation(async (_headers, _batches, _concurrency, onBatchSettled) => {
      const ok: BatchMappingOutcome = { batchIndex: 0, items: [fakeItem(0)], retries: 0, failed: false };
      const bad: BatchMappingOutcome = { batchIndex: 1, items: [], retries: 3, failed: true, errorMessage: "x" };
      onBatchSettled(ok);
      onBatchSettled(bad);
      return [ok, bad];
    });

    const handlers = makeHandlers();
    await runImportPipeline(HEADERS, rows, handlers);

    expect(handlers.events.find((e) => e.batchIndex === 0)?.status).toBe("completed");
    expect(handlers.events.find((e) => e.batchIndex === 1)?.status).toBe("failed");
  });

  it("counts retried batches in stats even when they eventually succeed", async () => {
    mapAllBatchesMock.mockImplementation(async (_headers, _batches, _concurrency, onBatchSettled) => {
      const outcome: BatchMappingOutcome = { batchIndex: 0, items: [fakeItem(0)], retries: 2, failed: false };
      onBatchSettled(outcome);
      return [outcome];
    });

    const handlers = makeHandlers();
    const result = await runImportPipeline(HEADERS, [ROWS[0]], handlers);

    expect(result.stats.retriedBatches).toBe(1);
    expect(result.stats.batchesFailed).toBe(0);
  });
});

describe("runImportPipeline — edge cases", () => {
  it("returns zeroed stats for an empty input with no batches", async () => {
    mapAllBatchesMock.mockImplementation(async () => []);

    const handlers = makeHandlers();
    const result = await runImportPipeline(HEADERS, [], handlers);

    expect(result.imported).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    expect(result.stats.totalRecords).toBe(0);
    expect(result.stats.averageConfidence).toBe(0);
  });
});