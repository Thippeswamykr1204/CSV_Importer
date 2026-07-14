import { GoogleGenerativeAI, GoogleGenerativeAIFetchError } from "@google/generative-ai";
import { buildBatchPrompt } from "@/lib/ai/prompt-builder";
import { repairAndParseJson } from "@/lib/ai/json-repair";
import { aiBatchResponseSchema, type AiBatchItem } from "@/lib/validators/schemas";
import { sanitizeRowForPrompt } from "@/lib/security/sanitize";
import { getEnv } from "@/lib/utils/env";
import type { Batch } from "@/lib/services/batch.service";

const MODEL_NAME = "gemini-2.5-flash";
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 800;
/**
 * Per-attempt timeout for a single generateContent call. Without this,
 * a hung request has no external bound: the SDK's own default is
 * generous (minutes), so a single stalled batch could tie up a worker
 * slot in mapAllBatches's concurrency pool indefinitely, starving every
 * other batch waiting behind it. 20s is comfortably above normal
 * latency for a 25-row batch at this model, while still failing fast
 * enough that the retry loop below gets a chance to try again instead
 * of the whole import silently stalling.
 */
const REQUEST_TIMEOUT_MS = 20_000;

export interface RawRow {
  rowIndex: number;
  data: Record<string, unknown>;
}

export interface BatchMappingOutcome {
  batchIndex: number;
  items: AiBatchItem[];
  retries: number;
  failed: boolean;
  errorMessage?: string;
}

function getClient(): GoogleGenerativeAI {
  const apiKey = getEnv().GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Set it in your environment to enable AI mapping."
    );
  }
  return new GoogleGenerativeAI(apiKey);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Decides whether an error is worth retrying.
 *
 * Retryable: rate limits (429), server-side hiccups (5xx), transient
 * network failures, and malformed-model-output errors (a fresh sample
 * can come back well-formed). Non-retryable: bad/missing API key
 * (401/403) and invalid request shape (400) — these fail the exact same
 * way every time, so retrying just burns attempts and backoff time
 * before reporting the same error anyway.
 */
function isRetryableError(err: unknown): boolean {
  if (err instanceof GoogleGenerativeAIFetchError) {
    const status = err.status;
    if (status === undefined) return true; // unknown shape — assume transient
    if (status === 429) return true;
    if (status >= 500) return true;
    return false; // 4xx (bad key, bad request, etc.) — won't fix itself
  }
  // Everything else (our own JSON/schema errors, network TypeErrors,
  // DNS failures) is treated as transient.
  return true;
}

/**
 * Calls the model for a single batch, with strict-JSON enforcement,
 * malformed-JSON repair, schema validation, and exponential-backoff
 * retry. Returns a best-effort outcome — callers decide how to treat a
 * batch that failed all retries (the importer marks every row in it as
 * skipped with an explicit reason rather than silently dropping data).
 */
export async function mapBatch(
  headers: string[],
  batch: Batch<RawRow>
): Promise<BatchMappingOutcome> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1, // low temperature — this is an extraction task, not a creative one
    },
  });

  const sanitizedRows = batch.rows.map((r) => ({
    rowIndex: r.rowIndex,
    data: sanitizeRowForPrompt(r.data),
  }));

  const { system, user } = buildBatchPrompt(headers, sanitizedRows);

  let lastError = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(
        {
          contents: [{ role: "user", parts: [{ text: user }] }],
          systemInstruction: { role: "system", parts: [{ text: system }] },
        },
        { timeout: REQUEST_TIMEOUT_MS }
      );

      const text = result.response.text();
      const parsed = repairAndParseJson(text);

      if (parsed === null) {
        lastError = "Model response was not valid JSON, even after repair.";
        throw new Error(lastError);
      }

      const validation = aiBatchResponseSchema.safeParse(parsed);
      if (!validation.success) {
        lastError = `Model response failed schema validation: ${validation.error.message}`;
        throw new Error(lastError);
      }

      const items = reconcileWithBatch(validation.data.items, batch.rows);

      return { batchIndex: batch.index, items, retries: attempt, failed: false };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);

      if (!isRetryableError(err)) {
        return {
          batchIndex: batch.index,
          items: [],
          retries: attempt,
          failed: true,
          errorMessage: lastError,
        };
      }

      if (attempt < MAX_RETRIES) {
        await sleep(BASE_BACKOFF_MS * 2 ** attempt);
        continue;
      }
    }
  }

  return {
    batchIndex: batch.index,
    items: [],
    retries: MAX_RETRIES,
    failed: true,
    errorMessage: lastError,
  };
}

/**
 * Defends against a model that drops, duplicates, or renumbers rows: for
 * every row we actually sent, take the model's item if present, else
 * synthesize a low-confidence skip so the row is never silently lost.
 */
function reconcileWithBatch(items: AiBatchItem[], sentRows: RawRow[]): AiBatchItem[] {
  const byIndex = new Map(items.map((item) => [item.rowIndex, item]));

  return sentRows.map((row) => {
    const found = byIndex.get(row.rowIndex);
    if (found) return found;

    return {
      rowIndex: row.rowIndex,
      skip: true,
      skipReason: "Model did not return a mapping for this row.",
      confidence: 0,
      record: {
        created_at: null,
        name: null,
        email: null,
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
      warnings: ["Row missing from AI response; auto-skipped to avoid data loss."],
    };
  });
}

/**
 * Runs batches with bounded concurrency so a large CSV doesn't fan out
 * hundreds of simultaneous requests and trip provider rate limits.
 */
export async function mapAllBatches(
  headers: string[],
  batches: Batch<RawRow>[],
  concurrency: number,
  onBatchSettled?: (outcome: BatchMappingOutcome) => void
): Promise<BatchMappingOutcome[]> {
  const results: BatchMappingOutcome[] = new Array(batches.length);
  let cursor = 0;

  async function worker() {
    while (cursor < batches.length) {
      const myIndex = cursor++;
      const outcome = await mapBatch(headers, batches[myIndex]);
      results[myIndex] = outcome;
      onBatchSettled?.(outcome);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, batches.length) }, worker);
  await Promise.all(workers);

  return results;
}