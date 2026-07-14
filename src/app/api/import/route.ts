import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { importRequestSchema, UPLOAD_LIMITS } from "@/lib/validators/schemas";
import { runImportPipeline } from "@/lib/services/import.service";
import { checkRateLimit, getClientIdentifier } from "@/lib/security/sanitize";
import { getEnv } from "@/lib/utils/env";
import type { ImportStage, ImportStreamEvent } from "@/lib/types/crm";

export const runtime = "nodejs";
export const maxDuration = 300;

// A generous ceiling on raw request body bytes, independent of the
// row-count cap enforced after JSON parsing. Rejecting on Content-Length
// avoids fully buffering (and JSON.parse-ing) a pathological payload
// before validation gets a chance to reject it on row count alone.
const MAX_REQUEST_BODY_BYTES = 15 * 1024 * 1024; // 15MB — headroom over the 8MB file cap for JSON overhead

/**
 * POST /api/import
 *
 * Stateless: accepts already-client-parsed CSV rows (the browser parses
 * for instant preview in Step 2; this endpoint is only invoked once the
 * user confirms "Import with AI"), runs the AI mapping pipeline, and
 * streams progress back over Server-Sent Events so the UI can show real
 * per-stage, per-batch progress instead of a single opaque spinner.
 *
 * Also used, unmodified, for the "retry failed rows" flow (Stage 5/6):
 * the client resubmits just the rows from batches that failed all
 * retries, as an ordinary import request against the same endpoint. No
 * separate retry route was needed — the endpoint was already generic
 * over (headers, rows).
 *
 * No database, no session, no server-side file storage — every request
 * is fully self-contained, which keeps this horizontally scalable
 * without any sticky-session or shared-state concerns.
 */
export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  const identifier = getClientIdentifier(req.headers);

  const rateLimit = checkRateLimit(identifier);
  if (!rateLimit.allowed) {
    return jsonError(
      429,
      `Too many import requests. Try again in ${Math.ceil((rateLimit.retryAfterMs ?? 0) / 1000)}s.`,
      requestId
    );
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BODY_BYTES) {
    return jsonError(413, "Request body is too large.", requestId);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Request body must be valid JSON.", requestId);
  }

  const parsed = importRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, `Invalid import request: ${parsed.error.issues[0]?.message}`, requestId);
  }

  const { headers, rows } = parsed.data;

  if (rows.length > UPLOAD_LIMITS.maxRows) {
    return jsonError(
      413,
      `CSV exceeds the ${UPLOAD_LIMITS.maxRows}-row limit for a single import.`,
      requestId
    );
  }

  let apiKey: string | undefined;
  try {
    apiKey = getEnv().GEMINI_API_KEY;
  } catch {
    return jsonError(500, "Server environment misconfiguration.", requestId);
  }

  if (!apiKey) {
    return jsonError(503, "AI mapping is not configured on this server (missing GEMINI_API_KEY).", requestId);
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ImportStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        send({ type: "stage", stage: "uploading", message: "Received CSV", progress: 5 });

        const result = await runImportPipeline(headers, rows, {
          onStage: (stage, message, progress) =>
            send({ type: "stage", stage: stage as ImportStage, message, progress }),
          onBatchEvent: (batchIndex, totalBatches, status, recordsInBatch) =>
            send({ type: "batch", batchIndex, totalBatches, status, recordsInBatch }),
        });

        send({ type: "result", result });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown server error during import.";
        console.error(`[import:${requestId}]`, message);
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Request-Id": requestId,
    },
  });
}

function jsonError(status: number, message: string, requestId: string) {
  return Response.json(
    { error: { code: status, message, requestId } },
    { status, headers: { "X-Request-Id": requestId } }
  );
}