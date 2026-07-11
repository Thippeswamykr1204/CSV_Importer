import { describe, it, expect } from "vitest";
import { getRetryableSkippedRecords, mergeRetryResult } from "@/lib/utils/retry";
import type { ImportResult } from "@/lib/types/crm";

function makeResult(overrides: Partial<ImportResult> = {}): ImportResult {
  return {
    stats: {
      totalRecords: 3,
      importedRecords: 1,
      skippedRecords: 2,
      averageConfidence: 0.9,
      processingTimeMs: 1000,
      batchesProcessed: 1,
      batchesFailed: 1,
      retriedBatches: 0,
    },
    imported: [
      {
        rowIndex: 0,
        confidence: 0.9,
        warnings: [],
        record: {
          created_at: null,
          name: "A",
          email: "a@x.com",
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
      },
    ],
    skipped: [
      { rowIndex: 1, raw: { email: "b@x.com" }, reason: "AI batch failed after retries: timeout" },
      { rowIndex: 2, raw: {}, reason: "Record has neither an email address nor a phone number." },
    ],
    ...overrides,
  };
}

describe("getRetryableSkippedRecords", () => {
  it("only returns rows skipped due to batch failure, not business-rule skips", () => {
    const result = makeResult();
    const retryable = getRetryableSkippedRecords(result.skipped);
    expect(retryable).toHaveLength(1);
    expect(retryable[0].rowIndex).toBe(1);
  });

  it("returns an empty array when nothing is retryable", () => {
    const result = makeResult({
      skipped: [{ rowIndex: 2, raw: {}, reason: "Record has neither an email nor a phone." }],
    });
    expect(getRetryableSkippedRecords(result.skipped)).toHaveLength(0);
  });
});

describe("mergeRetryResult", () => {
  it("moves a successfully-retried row from skipped into imported, preserving original row index", () => {
    const original = makeResult();
    const retried: ImportResult = {
      stats: {
        totalRecords: 1,
        importedRecords: 1,
        skippedRecords: 0,
        averageConfidence: 0.8,
        processingTimeMs: 500,
        batchesProcessed: 1,
        batchesFailed: 0,
        retriedBatches: 1,
      },
      imported: [
        {
          rowIndex: 0, // local index within the retry submission
          confidence: 0.8,
          warnings: [],
          record: {
            created_at: null,
            name: null,
            email: "b@x.com",
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
        },
      ],
      skipped: [],
    };

    const merged = mergeRetryResult(original, retried, [1]);

    expect(merged.imported).toHaveLength(2);
    expect(merged.imported.find((r) => r.rowIndex === 1)?.record.email).toBe("b@x.com");
    expect(merged.skipped).toHaveLength(1);
    expect(merged.skipped[0].rowIndex).toBe(2);
  });

  it("keeps a row in skipped if the retry fails again, remapped to the original index", () => {
    const original = makeResult();
    const retried: ImportResult = {
      stats: {
        totalRecords: 1,
        importedRecords: 0,
        skippedRecords: 1,
        averageConfidence: 0,
        processingTimeMs: 500,
        batchesProcessed: 1,
        batchesFailed: 1,
        retriedBatches: 1,
      },
      imported: [],
      skipped: [{ rowIndex: 0, raw: { email: "b@x.com" }, reason: "AI batch failed after retries: timeout again" }],
    };

    const merged = mergeRetryResult(original, retried, [1]);

    expect(merged.imported).toHaveLength(1);
    expect(merged.skipped).toHaveLength(2);
    expect(merged.skipped.find((r) => r.rowIndex === 1)?.reason).toContain("timeout again");
  });

  it("recomputes stats.importedRecords and skippedRecords to match the merged arrays", () => {
    const original = makeResult();
    const retried: ImportResult = {
      stats: {
        totalRecords: 1,
        importedRecords: 1,
        skippedRecords: 0,
        averageConfidence: 1,
        processingTimeMs: 100,
        batchesProcessed: 1,
        batchesFailed: 0,
        retriedBatches: 0,
      },
      imported: [
        {
          rowIndex: 0,
          confidence: 1,
          warnings: [],
          record: { ...original.imported[0].record, email: "b@x.com" },
        },
      ],
      skipped: [],
    };

    const merged = mergeRetryResult(original, retried, [1]);
    expect(merged.stats.importedRecords).toBe(merged.imported.length);
    expect(merged.stats.skippedRecords).toBe(merged.skipped.length);
  });
});
