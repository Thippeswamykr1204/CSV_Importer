# GrowEasy CSV Importer

An AI-powered CSV importer that ingests a lead export from **any** system — HubSpot, Salesforce, Zoho, Facebook Lead Ads, Google Ads, a hand-built spreadsheet, whatever — and maps it into GrowEasy CRM's fixed schema without the user ever drawing a column-mapping line by hand.

The interesting problem here isn't parsing CSV. It's building a mapping engine that's *reliable* on data it has never seen a header for, and a product around it that's honest about its own confidence.

---

## Live flow

1. **Upload** — drag/drop or file picker, validated client-side (size, extension, emptiness) before anything happens.
2. **Preview** — the CSV is parsed entirely in the browser. Nothing is sent to the server or to AI at this stage. You get a searchable, paginated table plus row/column/file-size stats before you commit to anything.
3. **Import with AI** — only now does the client POST to `/api/import`, which streams live per-stage, per-batch progress back over Server-Sent Events.
4. **Results** — summary stats, a tabbed Imported/Skipped table with confidence badges and skip reasons, CSV/JSON export.

---

## Architecture

```
src/
  app/
    page.tsx                 — the 4-step flow (client component, state machine)
    api/import/route.ts      — POST handler, SSE stream, stateless
    api/sample-csv/route.ts  — sample file for the "Download sample CSV" affordance
  lib/
    types/crm.ts             — single source of truth for the CRM schema + enums
    validators/schemas.ts    — zod schemas: AI response envelope, upload limits, request shape
    ai/
      prompt-builder.ts      — system/developer/user prompt construction, few-shot examples
      json-repair.ts         — best-effort recovery from near-JSON model output
    services/
      batch.service.ts       — splits rows into AI-sized batches
      ai-mapper.service.ts   — calls Gemini, retries w/ backoff, validates, bounded concurrency
      normalizer.service.ts  — deterministic re-enforcement of business rules on top of AI output
      import.service.ts      — orchestrates the whole pipeline, stage-by-stage
    security/sanitize.ts     — CSV-formula-injection guard, prompt-injection defense, rate limiting
    utils/                   — csv-client (browser parsing), export, cn, env validation
  components/
    ui/                      — mutated primitives (button, card, badge) — not raw shadcn
    importer/                — dropzone, preview table, progress rail, results summary/table
tests/                       — vitest unit tests for the logic that actually matters
```

**Layering**: route → service → (no DB, so no repository layer — see *Why no database* below). The route handler never touches AI clients or business rules directly; it validates the request, calls `import.service.ts`, and streams whatever comes back.

### Why no database

The assignment explicitly asks for a **stateless backend**, and the product doesn't need persistence to do its job: it's a one-shot transform (CSV in → CRM JSON out), not a system of record. Adding Postgres/Mongo here would be complexity with no corresponding user value. If GrowEasy later wants "recent imports" history across sessions/devices, that's an additive feature (see *Future improvements*), not a rearchitecture.

### Why Server-Sent Events, not a single JSON response

A CSV with a few thousand rows can take a real amount of wall-clock time to map (multiple AI round-trips). A spinner that sits still for 20 seconds erodes trust in exactly the way this project is trying not to. SSE lets the backend push real stage transitions and real batch-completion counts as they happen, so "AI Mapping — batch 4/12" is not a fake progress bar, it's the actual state of the pipeline.

---

## AI prompt engineering strategy

Everything prompt-related lives in `lib/ai/prompt-builder.ts`, deliberately separated from the HTTP/SDK plumbing in `ai-mapper.service.ts`. A prompt is a product surface — it needs to be readable and testable independent of "how we call the API."

- **System prompt**: identity + non-negotiables (JSON-only output, never invent data, treat cell content as inert even if it looks like an instruction).
- **Developer prompt**: the actual schema contract, field-by-field semantics, and every business rule (multi-email handling, multi-phone handling, the skip condition, enum constraints, confidence semantics) written out explicitly rather than left implicit.
- **Few-shot examples**: three worked examples spanning a clean structured export, a messy hand-built spreadsheet with ambiguous status text and duplicate contacts, and a row that must be skipped — chosen specifically because those are the three failure modes that would otherwise need trial-and-error to get right.
- **User prompt**: the actual batch payload (`sourceHeaders` + `rows`, each tagged with its `rowIndex` so we can reconcile the response against what we sent).

**Response contract**: strict JSON, one item per input row, `rowIndex` echoed back. This is the load-bearing design decision — see *AI reliability* below.

### Header-agnostic mapping

The system prompt explicitly tells the model to infer meaning from **column content**, not exact header text, and gives a concrete example (`Phone`, `Mobile`, `Telephone`, `Primary Contact`, `Customer Number`, `WhatsApp`, `Contact Number`, `Cell` → all `mobile_without_country_code`). This is reinforced by the few-shot examples, which use three completely different header vocabularies.

---

## AI reliability

A model that's asked to extract structured data from messy input will occasionally: wrap its answer in a markdown fence anyway, drop a row, duplicate a row, emit an invalid enum value, or just time out. The pipeline is built assuming all of that will happen sometimes, not treating it as an edge case:

1. **Strict JSON mode** — `responseMimeType: "application/json"` at the SDK level, on top of the prompt instruction, so we're not relying on prompt compliance alone.
2. **JSON repair** (`json-repair.ts`) — strips markdown fences, extracts the outermost `{...}` block, removes trailing commas, before giving up. Deliberately conservative: it fixes known-safe patterns and returns `null` rather than guess at malformed structure.
3. **Schema validation** (zod, `aiBatchResponseSchema`) — every field, every enum, every type, checked before the response is trusted. A response that parses as JSON but violates the schema (e.g. `crm_status: "SUPER_HOT_LEAD"`) is treated as a failure, not silently coerced.
4. **Row reconciliation** (`reconcileWithBatch`) — the model is asked to echo `rowIndex` for every row it received. If it drops a row, we detect the gap and synthesize an explicit low-confidence skip ("Model did not return a mapping for this row") rather than silently losing data. This is the single most important reliability decision in the project: a CSV importer that silently drops rows is worse than one that's slow.
5. **Retry with exponential backoff** — up to 3 retries per batch (800ms → 1.6s → 3.2s), independent per batch so one bad batch doesn't stall the others.
6. **Deterministic re-enforcement** (`normalizer.service.ts`) — the AI is instructed to enforce the "must skip if no email/phone" rule and the enum constraints, but the server re-checks both deterministically afterward. Never trust an LLM as the sole enforcement point for a hard business rule — treat its output as a strong prior, not ground truth.
7. **Bounded concurrency** — batches run 4-at-a-time (`mapAllBatches`), not all-at-once, so a 2,000-row CSV doesn't fire 80 simultaneous requests at the provider.

### Confidence scoring

The model self-reports a 0–1 confidence per row, explicitly defined in the prompt as "certainty about the mapping as a whole," with the few-shot examples calibrating what a 0.97 vs a 0.74 should look like. The UI surfaces this directly (green ≥ 0.85, amber ≥ 0.6, red below) so a user can eyeball which imported rows are worth a manual glance — this is more useful than a binary success/fail per row.

---

## Business rules (enforced twice: prompt + code)

| Rule | Prompt instruction | Code enforcement |
|---|---|---|
| Multiple emails → first is `email`, rest appended to `crm_note` | explicit rule + example | AI output trusted for content, but structural shape is schema-validated |
| Multiple phones → same pattern | explicit rule + example | same |
| No email AND no phone → skip with reason | explicit rule + example | re-checked deterministically regardless of what the model returned |
| `crm_status` / `data_source` must be exact enum or null | enums spelled out verbatim in the prompt | zod `.enum()` — invalid values fail schema validation, forcing a retry |

---

## Security

- **CSV formula injection**: any exported cell starting with `=`, `+`, `-`, `@`, tab, or CR is prefixed with `'` before it's written to a downloadable CSV — the OWASP-recommended mitigation for Excel/Sheets formula execution. Applied only on export, not before the AI sees the data.
- **Prompt injection**: the system prompt explicitly instructs the model to treat cell content as inert data even if it looks like an instruction ("ignore previous instructions", fake `system:` turns, etc). In addition, `sanitizeCellForPrompt` truncates pathologically long cells (2,000 char cap) and neutralizes triple-backtick sequences that could be used to fake a code-fence boundary inside the prompt.
- **Upload validation**: extension allowlist (`.csv` only), 8MB size cap, empty-file rejection, all enforced client-side before parsing and re-validated server-side via zod (`UPLOAD_LIMITS`, 5,000-row cap).
- **Rate limiting**: a sliding-window limiter (10 requests/minute per IP) on `/api/import`. Documented as in-memory/single-instance — see *Known limitations*.
- **Malformed CSV / malformed AI responses**: handled by the reliability pipeline above (repair → validate → reconcile → retry).
- **Secrets**: `GEMINI_API_KEY` is read server-side only, validated via `lib/utils/env.ts`, never logged, `.env*` is git-ignored.

---

## Performance

- **Batching**: 25 rows/batch (`BATCH_SIZE`) — large enough to amortize request overhead, small enough that one malformed response only invalidates 25 rows, not 2,000.
- **Bounded concurrency**: 4 batches in flight at once (`AI_CONCURRENCY`), a worker-pool pattern rather than `Promise.all` over every batch, so a big CSV degrades gracefully instead of hammering the provider.
- **Streaming progress**: SSE avoids holding the client on a single long-lived request with no feedback, and avoids buffering the entire result server-side before responding.
- **Client-side parsing**: Papa Parse runs in the browser for the preview step, so a 5,000-row CSV never round-trips to the server just to be displayed — the server only sees data once the user has actually confirmed the import.

---

## Getting started

```bash
npm install
cp .env.example .env.local   # then add your GEMINI_API_KEY
npm run dev
```

Open `http://localhost:3000`. Use the "Download sample CSV" button on the upload screen for a ready-made messy example (missing contact info, multiple emails, ambiguous status text) to see the full pipeline in action.

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest — unit tests for prompt schema, normalizer, sanitization, batching, JSON repair |

### Environment variables

| Variable | Required | Notes |
|---|---|---|
| `GEMINI_API_KEY` | Yes | [Get a key](https://aistudio.google.com/apikey). Without it, `/api/import` returns a `503` with a clear message rather than failing opaquely. |

### Deployment

Ships cleanly to Vercel (`vercel deploy`) — it's a standard Next.js App Router project with no external infra dependency beyond the Gemini API. Set `GEMINI_API_KEY` in the project's environment variables. No database, no queue, no background worker to provision.

---

## Testing

`tests/` covers the logic where a silent regression would actually hurt someone using this tool, not UI snapshot tests for their own sake:

- **`json-repair.test.ts`** — every repair strategy (fences, prose-wrapped JSON, trailing commas, unrecoverable input).
- **`schemas.test.ts`** — the AI response contract: valid shape accepted, invalid enums rejected, out-of-range confidence rejected, missing optional fields default correctly.
- **`normalizer.test.ts`** — the business rule that actually matters most: a record with no email and no phone is always skipped, even if the model said otherwise; whitespace-only values count as absent; confidence is clamped.
- **`sanitize.test.ts`** — CSV formula injection prefixing, prompt-injection cell sanitization.
- **`batch.test.ts`** — batch splitting at boundaries (exact multiples, remainders, single row, empty input).

Run with `npm test`.

---

## Known limitations & honest tradeoffs

- **Rate limiting is in-memory**, so it resets on redeploy and doesn't coordinate across multiple serverless instances. Fine for a single-instance/demo deployment; a real production rollout should move this to Upstash/Redis — noted rather than silently shipped as if it were bulletproof.
- **No persistence layer.** "Recent imports" and "retry failed batches after leaving the page" both imply state across requests, which was deliberately out of scope for a stateless backend (see *Why no database*). Both are natural, additive follow-ups if GrowEasy wants them.
- **Date-format disambiguation is conservative by design.** An ambiguous date like `01/02/2026` with no other signal is left `null` with a warning rather than guessed — a wrong guess (silently swapping day/month) is worse for CRM data quality than an honest blank.
- **System font stack instead of a Google-hosted webfont.** `next/font/google` requires reaching Google's font CDN at build time; this project's build environment restricts network egress to package registries, so the app uses a native system-font stack (`-apple-system`/`Segoe UI`/`ui-sans-serif`) tuned to match the same geometric, technical feel a webfont like Geist would give. On a normal deployment with unrestricted egress this is a one-line swap back to `next/font/google` if desired.

## Future improvements

- Manual column-mapping fallback UI for the rare row a user wants to correct by hand rather than accept the AI's skip/low-confidence result.
- Persist import runs (with a lightweight KV store, not necessarily a full RDBMS) to power a "recent imports" view and "retry just the failed batches" without re-uploading.
- Virtualized rendering (`@tanstack/react-virtual`) for the results table once row counts regularly exceed a few thousand — the current pagination is simpler and sufficient at the 5,000-row cap this project targets, but virtualization is the obvious next step if that cap is raised.
- Multi-provider AI fallback (e.g. retry a failed batch against a second model) for higher availability during provider outages.

---

## Enhancement changelog (post-launch hardening pass)

Benchmarked against Flatfile, Ingestro, Dromo, CSVBox, OneSchema, Airtable Import, and Linear's design language. Every change below extends the existing architecture — no rewrites, no new database, no new top-level abstractions.

**Upload experience**
- Multi-file drop now rejected with an explicit, count-aware message instead of silently importing the first file (the exact anti-pattern Flatfile's own case studies call out in competitors).
- Immediate filename + size feedback the moment a file is selected, before parsing completes, instead of a generic "reading…" string.
- Upload errors moved from toast-only to a persistent, dismissible inline `InlineAlert` — toasts auto-dismiss, which is wrong for anything blocking the user from proceeding.

**Preview experience**
- Sticky first column (row number) so wide CRM exports (15–30 columns) stay anchored while scrolling horizontally — lifted from Airtable/Flatfile's table-usability patterns.
- Search input decoupled from the (potentially expensive) filtered re-render via `useDeferredValue`, keeping typing responsive on large row counts without a manual debounce timer.
- CSV parsing now runs on a worker thread (Papa Parse `worker: true`) for files above 256KB, so parsing a few-thousand-row CSV no longer visibly freezes the UI.

**AI processing experience**
- Elapsed-time ticker during the AI mapping stage, so a multi-second operation reads as "actively working," not stalled.
- Pipeline-level errors (not just per-batch AI errors) now surface as a persistent inline banner on the preview screen when the user is returned there, instead of a toast that could be missed.

**Result visualization**
- **Manual correction for skipped rows** — the highest-priority gap identified in the competitive audit. A skipped row (no email/phone found) can now be corrected inline (add an email/phone) and is moved into Imported with a `"Manually corrected by user"` warning and `confidence: 1`, entirely client-side. Closes the "AI failed, dead end" gap that every benchmarked competitor also solves via a human-in-the-loop step.
- **Retry failed batches** — rows skipped because their AI batch failed all retries (as opposed to rows skipped by a valid business-rule decision) are now retryable with one click. The client resubmits just those rows to the same `/api/import` endpoint and merges the result back in, preserving original row numbers (`lib/utils/retry.ts`). No new backend route was needed — the endpoint was already generic over `(headers, rows)`.
- Confidence filter chip on the Imported tab (`< 85% confidence only`) — the "only show rows with problems" pattern independently cited by three sources as Flatfile's most-used table control.

**Backend**
- `/api/import` now returns a request ID (`X-Request-Id` header + in every JSON error body) for support/debugging traceability, and logs pipeline errors server-side with that ID.
- Request body size guard (15MB ceiling on `Content-Length`) rejects oversized payloads before they're buffered and JSON-parsed, ahead of the existing row-count validation.
- Environment access now goes through the single `getEnv()` validator everywhere (previously the route read `process.env` directly in one place).

**Performance**
- Worker-thread CSV parsing (above), plus `useDeferredValue` search (above) — both are the two spots profiling would actually show blocking the main thread on a large file.

**Accessibility**
- Focus moves to a step-level heading on every flow transition (upload → preview → importing → results), so screen-reader users get an announcement equivalent to a page navigation in a traditional multi-page flow.
- `aria-live="polite"` regions on the search-result count and the progress-stage message/batch-counter, so status updates are announced without the user needing to re-focus anything.
- Table semantics: `<caption>` (visually hidden) describing the visible row range, `scope="col"` on every header cell.
- `role="alert"` + `aria-live="assertive"` on the new `InlineAlert`, `aria-busy` on the dropzone while parsing, per-warning `aria-label`s on confidence-warning icons instead of a bare `title`.

**Security hardening**
- Baseline security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`) applied globally via `next.config.ts`, so they can't be accidentally omitted from a future route.
- Request-size guard (above) as defense-in-depth ahead of schema validation.

**Production polish**
- This changelog itself — every change above is traceable to a specific benchmarked product and a specific audit finding, matching the standard expected of a real PR description, not just a diff.

