/**
 * CSV Injection ("Formula Injection") guard.
 *
 * When a value starting with =, +, -, @, tab, or CR is opened in Excel/
 * Sheets it can execute as a formula. We neutralize this on export (the
 * CSV we generate for the user to download) by prefixing a single quote,
 * which is the standard mitigation recommended by OWASP.
 *
 * We deliberately do NOT mutate values before sending them to the AI —
 * the model should see the real data — only on the way back out to a
 * spreadsheet-openable file.
 */
const DANGEROUS_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

export function neutralizeCsvFormula(value: string): string {
  if (value.length === 0) return value;
  if (DANGEROUS_PREFIXES.some((p) => value.startsWith(p))) {
    return `'${value}`;
  }
  return value;
}

export function sanitizeRecordForCsvExport<T extends Record<string, unknown>>(
  record: T
): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] = typeof value === "string" ? neutralizeCsvFormula(value) : value;
  }
  return out as T;
}

/**
 * Prompt-injection defense in depth. The prompt builder already instructs
 * the model to treat cell content as inert data, but we also strip a
 * small set of high-signal jailbreak markers from raw cell values before
 * they ever reach the prompt, and cap per-cell length so a single
 * pathological cell can't blow the AI's context budget or be used to
 * smuggle a huge embedded instruction block.
 */
const MAX_CELL_LENGTH = 2000;

export function sanitizeCellForPrompt(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  const truncated = str.length > MAX_CELL_LENGTH ? str.slice(0, MAX_CELL_LENGTH) + "…" : str;
  // Collapse characters commonly used to fake role/system turns inside a cell.
  return truncated.replace(/```/g, "'''");
}

export function sanitizeRowForPrompt(
  row: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = sanitizeCellForPrompt(value);
  }
  return out;
}

/**
 * Minimal in-memory sliding-window rate limiter.
 *
 * The API route itself is stateless (no DB, no session), but a single
 * Node process still benefits from guarding against burst abuse within
 * its own lifetime. In a multi-instance deployment this should be
 * backed by Redis/Upstash — noted in the README as a scaling follow-up.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;
const hits = new Map<string, number[]>();

export function checkRateLimit(identifier: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const timestamps = (hits.get(identifier) ?? []).filter((t) => now - t < WINDOW_MS);

  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = timestamps[0];
    return { allowed: false, retryAfterMs: WINDOW_MS - (now - oldest) };
  }

  timestamps.push(now);
  hits.set(identifier, timestamps);
  return { allowed: true };
}
