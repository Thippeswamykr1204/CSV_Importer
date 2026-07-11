import { createBatches } from "@/lib/services/batch.service";
import { mapAllBatches, type RawRow } from "@/lib/services/ai-mapper.service";
import { normalizeBatchItem } from "@/lib/services/normalizer.service";
import type {
  ImportResult,
  ImportStats,
  MappedRecord,
  SkippedRecord,
} from "@/lib/types/crm";

const AI_CONCURRENCY = 4;

export interface ImportProgressHandlers {
  onStage: (stage: string, message: string, progress: number) => void;
  onBatchEvent: (
    batchIndex: number,
    totalBatches: number,
    status: "started" | "completed" | "retrying" | "failed",
    recordsInBatch: number
  ) => void;
}

export async function runImportPipeline(
  headers: string[],
  rows: Record<string, unknown>[],
  handlers: ImportProgressHandlers
): Promise<ImportResult> {
  const startedAt = Date.now();

  handlers.onStage("parsing", "Normalizing parsed rows", 10);
  const rawRows: RawRow[] = rows.map((data, rowIndex) => ({ rowIndex, data }));
  const rawByIndex = new Map(rawRows.map((r) => [r.rowIndex, r.data]));

  handlers.onStage("batching", "Preparing AI batches", 20);
  const batches = createBatches(rawRows);

  handlers.onStage(
    "mapping",
    `Mapping ${rawRows.length} record(s) across ${batches.length} batch(es)`,
    30
  );

  let completedBatches = 0;
  let retriedBatches = 0;
  let failedBatches = 0;

  const outcomes = await mapAllBatches(headers, batches, AI_CONCURRENCY, (outcome) => {
    completedBatches += 1;
    if (outcome.retries > 0) retriedBatches += 1;
    if (outcome.failed) failedBatches += 1;

    handlers.onBatchEvent(
      outcome.batchIndex,
      batches.length,
      outcome.failed ? "failed" : "completed",
      batches[outcome.batchIndex]?.rows.length ?? 0
    );

    const progress = 30 + Math.round((completedBatches / batches.length) * 50);
    handlers.onStage(
      "mapping",
      `Mapped ${completedBatches}/${batches.length} batches`,
      Math.min(progress, 80)
    );
  });

  handlers.onStage("validating", "Applying business rules and validation", 85);

  const imported: MappedRecord[] = [];
  const skipped: SkippedRecord[] = [];

  for (const outcome of outcomes) {
    if (outcome.failed) {
      const batch = batches[outcome.batchIndex];
      for (const row of batch.rows) {
        skipped.push({
          rowIndex: row.rowIndex,
          raw: row.data,
          reason: `AI batch failed after retries: ${outcome.errorMessage ?? "unknown error"}`,
        });
      }
      continue;
    }

    for (const item of outcome.items) {
      const raw = rawByIndex.get(item.rowIndex) ?? {};
      const normalized = normalizeBatchItem(item, raw);
      if (normalized.kind === "imported") {
        imported.push(normalized.record);
      } else {
        skipped.push(normalized.record);
      }
    }
  }

  handlers.onStage("finalizing", "Compiling results", 95);

  const stats: ImportStats = {
    totalRecords: rows.length,
    importedRecords: imported.length,
    skippedRecords: skipped.length,
    averageConfidence: average(imported.map((r) => r.confidence)),
    processingTimeMs: Date.now() - startedAt,
    batchesProcessed: batches.length,
    batchesFailed: failedBatches,
    retriedBatches,
  };

  handlers.onStage("done", "Import complete", 100);

  imported.sort((a, b) => a.rowIndex - b.rowIndex);
  skipped.sort((a, b) => a.rowIndex - b.rowIndex);

  return { stats, imported, skipped };
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
