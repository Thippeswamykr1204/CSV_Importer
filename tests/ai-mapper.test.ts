import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.GEMINI_API_KEY = "test-key";

const { generateContentMock } = vi.hoisted(() => ({ generateContentMock: vi.fn() }));

vi.mock("@google/generative-ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@google/generative-ai")>();
  return {
    ...actual,
    GoogleGenerativeAI: vi.fn().mockImplementation(function MockGoogleGenerativeAI() {
      return {
        getGenerativeModel: () => ({
          generateContent: generateContentMock,
        }),
      };
    }),
  };
});

import { mapBatch, mapAllBatches, type RawRow } from "@/lib/services/ai-mapper.service";
import { GoogleGenerativeAIFetchError } from "@google/generative-ai";
import { createBatches } from "@/lib/services/batch.service";
import type { AiBatchItem } from "@/lib/validators/schemas";

const HEADERS = ["Name", "Email"];

function row(rowIndex: number, data: Record<string, unknown> = { Name: "Jane", Email: "jane@x.com" }): RawRow {
  return { rowIndex, data };
}

function fakeItem(rowIndex: number, overrides: Partial<AiBatchItem> = {}): AiBatchItem {
  return {
    rowIndex,
    skip: false,
    skipReason: null,
    confidence: 0.9,
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

/** Shapes a mock Gemini SDK response the same way `result.response.text()` would. */
function genAiResult(json: unknown) {
  return { response: { text: () => JSON.stringify(json) } };
}

beforeEach(() => {
  generateContentMock.mockReset();
});

describe("mapBatch — success path", () => {
  it("returns validated items with zero retries on a clean response", async () => {
    generateContentMock.mockResolvedValueOnce(genAiResult({ items: [fakeItem(0), fakeItem(1)] }));

    const batch = createBatches([row(0), row(1)])[0];
    const outcome = await mapBatch(HEADERS, batch);

    expect(outcome.failed).toBe(false);
    expect(outcome.retries).toBe(0);
    expect(outcome.items).toHaveLength(2);
    expect(outcome.items.map((i) => i.rowIndex)).toEqual([0, 1]);
  });

  it("synthesizes a low-confidence skip for any row the model dropped", async () => {
    // Model only returns row 0, silently drops row 1.
    generateContentMock.mockResolvedValueOnce(genAiResult({ items: [fakeItem(0)] }));

    const batch = createBatches([row(0), row(1)])[0];
    const outcome = await mapBatch(HEADERS, batch);

    expect(outcome.failed).toBe(false);
    expect(outcome.items).toHaveLength(2);
    const synthesized = outcome.items.find((i) => i.rowIndex === 1);
    expect(synthesized?.skip).toBe(true);
    expect(synthesized?.confidence).toBe(0);
    expect(synthesized?.warnings).toContain("Row missing from AI response; auto-skipped to avoid data loss.");
  });
});

describe("mapBatch — retry classification", () => {
  it("retries on a 429 rate-limit error and succeeds on the next attempt", async () => {
    vi.useFakeTimers();
    try {
      generateContentMock
        .mockRejectedValueOnce(new GoogleGenerativeAIFetchError("rate limited", 429, "Too Many Requests"))
        .mockResolvedValueOnce(genAiResult({ items: [fakeItem(0)] }));

      const batch = createBatches([row(0)])[0];
      const promise = mapBatch(HEADERS, batch);
      await vi.runAllTimersAsync();
      const outcome = await promise;

      expect(outcome.failed).toBe(false);
      expect(outcome.retries).toBe(1);
      expect(generateContentMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries on a 500 server error", async () => {
    vi.useFakeTimers();
    try {
      generateContentMock
        .mockRejectedValueOnce(new GoogleGenerativeAIFetchError("server error", 503, "Service Unavailable"))
        .mockResolvedValueOnce(genAiResult({ items: [fakeItem(0)] }));

      const batch = createBatches([row(0)])[0];
      const promise = mapBatch(HEADERS, batch);
      await vi.runAllTimersAsync();
      const outcome = await promise;

      expect(outcome.failed).toBe(false);
      expect(generateContentMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails fast on a 401/403 auth error without retrying", async () => {
    generateContentMock.mockRejectedValue(
      new GoogleGenerativeAIFetchError("bad api key", 401, "Unauthorized")
    );

    const batch = createBatches([row(0)])[0];
    const outcome = await mapBatch(HEADERS, batch);

    expect(outcome.failed).toBe(true);
    expect(outcome.retries).toBe(0); // failed on the first attempt, no retries burned
    expect(generateContentMock).toHaveBeenCalledTimes(1);
    expect(outcome.errorMessage).toContain("bad api key");
  });

  it("fails fast on a 400 bad-request error without retrying", async () => {
    generateContentMock.mockRejectedValue(
      new GoogleGenerativeAIFetchError("invalid request", 400, "Bad Request")
    );

    const batch = createBatches([row(0)])[0];
    const outcome = await mapBatch(HEADERS, batch);

    expect(outcome.failed).toBe(true);
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it("exhausts all retries and reports failure on persistent malformed JSON", async () => {
    vi.useFakeTimers();
    try {
      generateContentMock.mockResolvedValue({ response: { text: () => "not json at all" } });

      const batch = createBatches([row(0)])[0];
      const promise = mapBatch(HEADERS, batch);
      await vi.runAllTimersAsync();
      const outcome = await promise;

      expect(outcome.failed).toBe(true);
      expect(outcome.items).toEqual([]);
      expect(generateContentMock).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
      expect(outcome.errorMessage).toContain("not valid JSON");
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails when the model response fails schema validation after all retries", async () => {
    vi.useFakeTimers();
    try {
      generateContentMock.mockResolvedValue(genAiResult({ items: [{ rowIndex: "not-a-number" }] }));

      const batch = createBatches([row(0)])[0];
      const promise = mapBatch(HEADERS, batch);
      await vi.runAllTimersAsync();
      const outcome = await promise;

      expect(outcome.failed).toBe(true);
      expect(outcome.errorMessage).toContain("schema validation");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("mapBatch — request timeout", () => {
  it("passes a request timeout to generateContent so a hung call can't block a worker forever", async () => {
    generateContentMock.mockResolvedValueOnce(genAiResult({ items: [fakeItem(0)] }));

    const batch = createBatches([row(0)])[0];
    await mapBatch(HEADERS, batch);

    expect(generateContentMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ timeout: expect.any(Number) })
    );
  });
});
describe("mapAllBatches", () => {
  it("processes every batch and preserves batch order in the results array", async () => {
    generateContentMock.mockImplementation(async () =>
      genAiResult({ items: [fakeItem(0)] })
    );

    const rows = Array.from({ length: 5 }, (_, i) => row(i));
    const batches = createBatches(rows, 1); // 5 single-row batches
    const results = await mapAllBatches(HEADERS, batches, 2);

    expect(results).toHaveLength(5);
    results.forEach((r, i) => expect(r.batchIndex).toBe(i));
  });

  it("invokes onBatchSettled for every batch as it completes", async () => {
    generateContentMock.mockImplementation(async () => genAiResult({ items: [fakeItem(0)] }));

    const rows = Array.from({ length: 3 }, (_, i) => row(i));
    const batches = createBatches(rows, 1);
    const seen: number[] = [];

    await mapAllBatches(HEADERS, batches, 3, (outcome) => seen.push(outcome.batchIndex));

    expect(seen.sort()).toEqual([0, 1, 2]);
  });
});