import type { ImportResult, ImportStats, SkippedRecord } from "@/lib/types/crm";

/** A batch that failed all retries is recorded with this reason prefix in import.service.ts. */
export const BATCH_FAILURE_REASON_PREFIX = "AI batch failed after retries";

export function getRetryableSkippedRecords(skipped: SkippedRecord[]): SkippedRecord[] {
  return skipped.filter((r) => r.reason.startsWith(BATCH_FAILURE_REASON_PREFIX));
}

/**
 * Merges a retry run's result back into the original result, remapping the
 * retry's local row indices (0..N-1, since it was submitted as an isolated
 * subset) back to the original CSV's row indices so the Results table's
 * row numbers stay meaningful and stable across retries.
 */
export function mergeRetryResult(
  original: ImportResult,
  retried: ImportResult,
  originalIndicesInOrder: number[]
): ImportResult {
  const retriedOriginalIndices = new Set(originalIndicesInOrder);

  const remainingSkipped = original.skipped.filter((r) => !retriedOriginalIndices.has(r.rowIndex));
  const remainingImported = original.imported.filter((r) => !retriedOriginalIndices.has(r.rowIndex));

  const newImported = retried.imported.map((r) => ({
    ...r,
    rowIndex: originalIndicesInOrder[r.rowIndex],
  }));
  const newSkipped = retried.skipped.map((r) => ({
    ...r,
    rowIndex: originalIndicesInOrder[r.rowIndex],
  }));

  const imported = [...remainingImported, ...newImported].sort((a, b) => a.rowIndex - b.rowIndex);
  const skipped = [...remainingSkipped, ...newSkipped].sort((a, b) => a.rowIndex - b.rowIndex);

  const stats: ImportStats = {
    totalRecords: original.stats.totalRecords,
    importedRecords: imported.length,
    skippedRecords: skipped.length,
    averageConfidence:
      imported.length === 0
        ? 0
        : imported.reduce((sum, r) => sum + r.confidence, 0) / imported.length,
    processingTimeMs: original.stats.processingTimeMs + retried.stats.processingTimeMs,
    batchesProcessed: original.stats.batchesProcessed + retried.stats.batchesProcessed,
    batchesFailed: retried.stats.batchesFailed,
    retriedBatches: original.stats.retriedBatches + retried.stats.retriedBatches,
  };

  return { stats, imported, skipped };
}
