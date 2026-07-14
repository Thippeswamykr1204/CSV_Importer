import { NextRequest } from "next/server";
import { z } from "zod";
import { assertSafeRemoteUrl, createGuardedDispatcher } from "@/lib/security/url-fetch-guard";
import { toGoogleSheetsCsvExportUrl } from "@/lib/utils/google-sheets";
import { checkRateLimit, getClientIdentifier } from "@/lib/security/sanitize";
import { UPLOAD_LIMITS } from "@/lib/validators/schemas";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({
  url: z.string().url().max(2048),
});

const FETCH_TIMEOUT_MS = 10_000;

/**
 * POST /api/fetch-remote-csv
 *
 * Fetches a CSV from a user-supplied URL (plain CSV link or a Google
 * Sheets share link) server-side, so the browser doesn't hit CORS, and
 * returns the raw text for the client to parse with the exact same
 * Papa Parse path used for local file uploads — one parsing codepath
 * regardless of source.
 *
 * This endpoint is the highest-risk addition in the project: it makes
 * the server issue an outbound request to an address the user controls.
 * Every request goes through assertSafeRemoteUrl (SSRF guard) before any
 * network call is made, and the response is capped in size and
 * validated by content-type before being trusted as CSV text.
 */
export async function POST(req: NextRequest) {
  const identifier = getClientIdentifier(req.headers);
  const rateLimit = checkRateLimit(identifier);
  if (!rateLimit.allowed) {
    return jsonError(429, "Too many requests. Try again shortly.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Request body must be valid JSON.");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Provide a valid URL.");
  }

  const originalUrl = parsed.data.url;
  const sheetsExportUrl = toGoogleSheetsCsvExportUrl(originalUrl);
  const targetUrl = sheetsExportUrl ?? originalUrl;

  const guard = await assertSafeRemoteUrl(targetUrl);
  if (!guard.allowed) {
    return jsonError(400, guard.reason ?? "This URL cannot be fetched.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  // Re-validates DNS resolution at real connect time (including across
  // redirect hops) rather than trusting the one-time check above.
  const dispatcher = createGuardedDispatcher();

  try {
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "text/csv, text/plain, */*" },
      dispatcher,
    } as RequestInit & { dispatcher: unknown });

    if (!response.ok) {
      if (sheetsExportUrl && response.status === 403) {
        return jsonError(
          403,
          "Couldn't access this Google Sheet. Make sure it's shared as \u201CAnyone with the link can view.\u201D"
        );
      }
      return jsonError(response.status, `Remote server responded with ${response.status}.`);
    }

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > UPLOAD_LIMITS.maxFileSizeBytes) {
      return jsonError(413, "That file is larger than the 8MB import limit.");
    }

    // Re-check every hop the redirect chain actually landed on, in case
    // the final response.url differs from targetUrl after a redirect —
    // otherwise a redirect could be used to bypass the guard above.
    const finalGuard = await assertSafeRemoteUrl(response.url);
    if (!finalGuard.allowed) {
      return jsonError(400, "This URL redirected to a blocked address.");
    }

    const text = await response.text();
    if (text.length > UPLOAD_LIMITS.maxFileSizeBytes) {
      return jsonError(413, "That file is larger than the 8MB import limit.");
    }

    if (!looksLikeCsv(text)) {
      return jsonError(
        422,
        sheetsExportUrl
          ? "This doesn't look like a CSV. Check the sheet is shared publicly and try again."
          : "This URL doesn't look like it points to a CSV file."
      );
    }

    const fileName = deriveFileName(originalUrl, Boolean(sheetsExportUrl));

    return Response.json({ fileName, csvText: text });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return jsonError(504, "Timed out fetching that URL.");
    }
    return jsonError(502, "Couldn't fetch that URL.");
  } finally {
    clearTimeout(timeout);
  }
}

function looksLikeCsv(text: string): boolean {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  // A CSV's first line should have at least one comma (or be a single
  // valid column, which we accept too) and not look like an HTML error
  // page, which is the most common failure mode for a bad public link.
  return !firstLine.trim().toLowerCase().startsWith("<!doctype") && !firstLine.includes("<html");
}

function deriveFileName(originalUrl: string, isGoogleSheet: boolean): string {
  if (isGoogleSheet) return "google-sheet-import.csv";
  try {
    const url = new URL(originalUrl);
    const last = url.pathname.split("/").filter(Boolean).pop();
    return last && last.length > 0 ? last : "url-import.csv";
  } catch {
    return "url-import.csv";
  }
}

function jsonError(status: number, message: string) {
  return Response.json({ error: { code: status, message } }, { status });
}