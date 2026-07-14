"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Zap, Sparkles, ShieldCheck, Lock, History, HelpCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Dropzone } from "@/components/importer/dropzone";
import { PreviewTable } from "@/components/importer/preview-table";
import { ProgressStages } from "@/components/importer/progress-stages";
import { ResultsSummary } from "@/components/importer/results-summary";
import { ResultsTable, DownloadAllHint } from "@/components/importer/results-table";
import { ImportHistoryPanel } from "@/components/importer/import-history-panel";
import { HelpPanel } from "@/components/importer/help-panel";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getRetryableSkippedRecords, mergeRetryResult } from "@/lib/utils/retry";
import { addImportHistoryEntry } from "@/lib/utils/history";
import type { ParsedCsv } from "@/lib/utils/csv-client";
import type { ImportResult, ImportStage, ImportStreamEvent, MappedRecord } from "@/lib/types/crm";

type FlowStep = "upload" | "preview" | "importing" | "results";

/**
 * Runs the import pipeline against an arbitrary (headers, rows) payload
 * and streams progress via the provided callbacks. Shared by both the
 * initial import and the "retry failed rows" flow (Stage 5/6) so the
 * SSE-consumption logic lives in exactly one place.
 */
async function streamImport(
  headers: string[],
  rows: Record<string, unknown>[],
  onEvent: (event: ImportStreamEvent) => void
): Promise<void> {
  const response = await fetch("/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: "retry-batch.csv", headers, rows }),
  });

  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Import failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const raw of events) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      const jsonStr = line.slice(5).trim();
      if (!jsonStr) continue;
      onEvent(JSON.parse(jsonStr) as ImportStreamEvent);
    }
  }
}

export default function Home() {
  const [step, setStep] = useState<FlowStep>("upload");
  const [csv, setCsv] = useState<ParsedCsv | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const [stage, setStage] = useState<ImportStage>("uploading");
  const [progress, setProgress] = useState(0);
  const [stageMessage, setStageMessage] = useState("");
  const [batchesCompleted, setBatchesCompleted] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the step heading on every transition so screen-reader
  // users get an announcement of the new step, not silence — the SPA
  // equivalent of a page navigation, which native browser nav gives you
  // for free but a single-page flow like this does not.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (step !== "importing") return;
    const startedAt = Date.now();
    const interval = setInterval(() => setElapsedMs(Date.now() - startedAt), 250);
    return () => clearInterval(interval);
  }, [step]);

  const reset = useCallback(() => {
    setStep("upload");
    setCsv(null);
    setResult(null);
    setPipelineError(null);
    setProgress(0);
    setBatchesCompleted(0);
    setTotalBatches(0);
    setElapsedMs(0);
  }, []);

  const runImport = useCallback(async (data: ParsedCsv) => {
    setStep("importing");
    setPipelineError(null);
    setProgress(0);
    setBatchesCompleted(0);
    setTotalBatches(0);
    setStage("uploading");
    setStageMessage("Sending CSV to the server…");

    try {
      let finalResult: ImportResult | null = null;

      await streamImport(data.headers, data.rows, (event) => {
        if (event.type === "stage") {
          setStage(event.stage);
          setProgress(event.progress);
          setStageMessage(event.message);
        } else if (event.type === "batch") {
          setTotalBatches(event.totalBatches);
          if (event.status === "completed" || event.status === "failed") {
            setBatchesCompleted((c) => c + 1);
          }
        } else if (event.type === "result") {
          finalResult = event.result;
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      });

      if (finalResult) {
        setResult(finalResult);
        setStep("results");
        const { importedRecords, skippedRecords } = (finalResult as ImportResult).stats;
        toast.success(`Imported ${importedRecords} record(s), skipped ${skippedRecords}.`);
        addImportHistoryEntry(data.fileName, (finalResult as ImportResult).stats);
        setHistoryRefreshKey((k) => k + 1);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error during import.";
      setPipelineError(message);
      setStep("preview");
    }
  }, []);

  const handleRetryFailedBatches = useCallback(async () => {
    if (!result || !csv) return;
    const retryable = getRetryableSkippedRecords(result.skipped);
    if (retryable.length === 0) return;

    setIsRetrying(true);
    try {
      const originalIndices = retryable.map((r) => r.rowIndex);
      const subRows = retryable.map((r) => r.raw);
      let retriedResult: ImportResult | null = null;

      await streamImport(csv.headers, subRows, (event) => {
        if (event.type === "result") retriedResult = event.result;
        if (event.type === "error") throw new Error(event.message);
      });

      if (retriedResult) {
        const merged = mergeRetryResult(result, retriedResult, originalIndices);
        setResult(merged);
        const stillFailed = getRetryableSkippedRecords(merged.skipped).length;
        toast.success(
          stillFailed === 0
            ? "All previously failed rows were recovered."
            : `Recovered some rows — ${stillFailed} still failed and can be retried again.`
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed.");
    } finally {
      setIsRetrying(false);
    }
  }, [result, csv]);

  const handleManualFix = useCallback(
    (rowIndex: number, email: string, mobile: string) => {
      setResult((prev) => {
        if (!prev) return prev;
        const skippedEntry = prev.skipped.find((r) => r.rowIndex === rowIndex);
        if (!skippedEntry) return prev;

        const manualRecord: MappedRecord = {
          rowIndex,
          confidence: 1,
          warnings: ["Manually corrected by user after being skipped by AI mapping."],
          record: {
            created_at: null,
            name: typeof skippedEntry.raw.name === "string" ? skippedEntry.raw.name : null,
            email: email || null,
            country_code: mobile ? "+91" : null,
            mobile_without_country_code: mobile || null,
            company: null,
            city: null,
            state: null,
            country: null,
            lead_owner: null,
            crm_status: null,
            crm_note: "Contact info added manually after AI could not find it.",
            data_source: null,
            possession_time: null,
            description: null,
          },
        };

        const imported = [...prev.imported, manualRecord].sort((a, b) => a.rowIndex - b.rowIndex);
        const skipped = prev.skipped.filter((r) => r.rowIndex !== rowIndex);

        return {
          stats: {
            ...prev.stats,
            importedRecords: imported.length,
            skippedRecords: skipped.length,
            averageConfidence:
              imported.reduce((sum, r) => sum + r.confidence, 0) / imported.length,
          },
          imported,
          skipped,
        };
      });
      toast.success(`Row ${rowIndex + 1} moved to Imported.`);
    },
    []
  );

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-[6px] bg-accent">
              <Zap className="size-3.5 text-white" fill="white" strokeWidth={0} />
            </div>
            <span className="text-[13px] font-semibold tracking-tight">ImportCSV Pro</span>
          </Link>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              className="hidden sm:flex items-center gap-1.5 text-[12.5px] text-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <History className="size-3.5" />
              Import History
            </button>
            <button
              type="button"
              onClick={() => setIsHelpOpen(true)}
              className="hidden sm:flex items-center gap-1.5 text-[12.5px] text-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <HelpCircle className="size-3.5" />
              Help
            </button>
            {step !== "upload" && (
              <Button variant="ghost" size="sm" onClick={reset}>
                <RotateCcw className="size-3.5" />
                Start over
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-10">
        <AnimatePresence mode="wait">
          {step === "upload" && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="max-w-3xl mx-auto"
            >
              <div className="text-center mb-8 flex flex-col items-center">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-muted px-3 py-1 text-[11px] font-medium text-accent tracking-wide mb-5">
                  <Sparkles className="size-3" />
                  AI-POWERED IMPORT
                </div>

                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="text-[28px] sm:text-[32px] font-semibold tracking-tight text-foreground outline-none leading-tight"
                >
                  Import leads from{" "}
                  <span className="bg-gradient-to-r from-accent to-[#a78bfa] bg-clip-text text-transparent">
                    anywhere
                  </span>
                </h1>
                <p className="text-[13.5px] text-muted mt-2.5 max-w-md">
                  Upload any CSV export from any system. Our AI will understand the columns and
                  help you import with confidence.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6 text-[12px] text-muted">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-accent" />
                    AI column detection
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-accent" />
                    Works with any format
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Lock className="size-3.5 text-accent" />
                    Secure &amp; private
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Zap className="size-3.5 text-accent" />
                    No setup required
                  </span>
                </div>
              </div>
              <Dropzone onParsed={(parsed) => { setCsv(parsed); setStep("preview"); }} />
            </motion.div>
          )}

          {step === "preview" && csv && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <h1 ref={headingRef} tabIndex={-1} className="sr-only">
                Preview {csv.fileName}
              </h1>
              {pipelineError && (
                <InlineAlert message={pipelineError} onDismiss={() => setPipelineError(null)} />
              )}
              <PreviewTable
                data={csv}
                onConfirm={() => runImport(csv)}
                onReset={reset}
                isSubmitting={false}
              />
            </motion.div>
          )}

          {step === "importing" && (
            <motion.div
              key="importing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="max-w-2xl mx-auto"
            >
              <h1 ref={headingRef} tabIndex={-1} className="sr-only">
                Importing {csv?.fileName}
              </h1>
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <p className="text-[13px] font-medium text-foreground">
                    Importing <span className="text-muted">{csv?.fileName}</span>
                  </p>
                  <span className="text-[11px] text-muted-2 font-mono tabular">
                    {(elapsedMs / 1000).toFixed(1)}s
                  </span>
                </div>
                <ProgressStages
                  currentStage={stage}
                  progress={progress}
                  message={stageMessage}
                  batchesCompleted={batchesCompleted}
                  totalBatches={totalBatches}
                />
              </Card>
            </motion.div>
          )}

          {step === "results" && result && csv && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <h1 ref={headingRef} tabIndex={-1} className="sr-only">
                Import results for {csv.fileName}
              </h1>
              <ResultsSummary stats={result.stats} />
              <ResultsTable
                result={result}
                sourceFileName={csv.fileName}
                onManualFix={handleManualFix}
                onRetryFailedBatches={handleRetryFailedBatches}
                isRetrying={isRetrying}
              />
              <DownloadAllHint />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <ImportHistoryPanel
        open={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        refreshKey={historyRefreshKey}
      />
      <HelpPanel open={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}