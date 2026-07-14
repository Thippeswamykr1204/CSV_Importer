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
 *
 * Pruning on access alone isn't enough to bound memory: an identifier
 * that hits once and never comes back would sit in the map forever,
 * since nothing ever calls checkRateLimit for it again to trigger a
 * prune. A background sweep runs every window to drop any identifier
 * whose timestamps have all aged out, so a burst of one-off/spoofed
 * identifiers (each used for a single request) doesn't leak memory for
 * the life of the process.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;
const hits = new Map<string, number[]>();

function sweepExpired(): void {
  const now = Date.now();
  for (const [identifier, timestamps] of hits) {
    const remaining = timestamps.filter((t) => now - t < WINDOW_MS);
    if (remaining.length === 0) {
      hits.delete(identifier);
    } else if (remaining.length !== timestamps.length) {
      hits.set(identifier, remaining);
    }
  }
}

const sweepTimer = setInterval(sweepExpired, WINDOW_MS);
// Don't let this background timer keep a serverless/test process alive.
sweepTimer.unref?.();

export function checkRateLimit(identifier: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const timestamps = (hits.get(identifier) ?? []).filter((t) => now - t < WINDOW_MS);

  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    hits.set(identifier, timestamps);
    const oldest = timestamps[0];
    return { allowed: false, retryAfterMs: WINDOW_MS - (now - oldest) };
  }

  timestamps.push(now);
  hits.set(identifier, timestamps);
  return { allowed: true };
}

/**
 * Best-effort client identifier for rate limiting.
 *
 * `x-forwarded-for` is client-suppliable on a direct request and can't
 * be cryptographically trusted — a determined attacker can rotate it
 * per request to dodge the limiter entirely. On Vercel/most reverse
 * proxies the *first* entry in the (possibly comma-separated) header is
 * the original client as seen by the edge, so we use that rather than
 * the raw header value, which is the best available signal without
 * adding an edge-config/IP-header allowlist. This is intentionally a
 * soft control (documented above as needing Redis/Upstash for real
 * multi-instance enforcement) — not a substitute for auth-based limits
 * on any route that ends up needing stronger guarantees.
 */
export function getClientIdentifier(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "anonymous";
}