/**
 * Splits rows into fixed-size batches for AI processing.
 *
 * Batch size is a deliberate tradeoff: larger batches mean fewer API
 * calls (cheaper, faster wall-clock) but a single malformed response
 * invalidates more rows and costs more to retry; smaller batches isolate
 * failures but multiply request overhead and rate-limit risk. 25 rows
 * keeps a single batch comfortably inside typical context windows even
 * for wide, note-heavy CSVs, while keeping the blast radius of a retry
 * small.
 */
export const BATCH_SIZE = 25;

export interface Batch<T> {
  index: number;
  rows: T[];
}

export function createBatches<T>(rows: T[], batchSize: number = BATCH_SIZE): Batch<T>[] {
  const batches: Batch<T>[] = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    batches.push({ index: batches.length, rows: rows.slice(i, i + batchSize) });
  }
  return batches;
}
