"use client";

import { useMemo, useState } from "react";
import { Download, FileJson, FileText, AlertTriangle, RotateCw, Pencil, Check, X, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge, confidenceTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { exportImportedAsCsv, exportImportedAsJson } from "@/lib/utils/export";
import { getRetryableSkippedRecords } from "@/lib/utils/retry";
import type { ImportResult, SkippedRecord } from "@/lib/types/crm";

const PAGE_SIZE = 20;
const LOW_CONFIDENCE_THRESHOLD = 0.85;

interface ResultsTableProps {
  result: ImportResult;
  sourceFileName: string;
  onManualFix: (rowIndex: number, email: string, mobile: string) => void;
  onRetryFailedBatches: () => void;
  isRetrying: boolean;
}

export function ResultsTable({
  result,
  sourceFileName,
  onManualFix,
  onRetryFailedBatches,
  isRetrying,
}: ResultsTableProps) {
  const [tab, setTab] = useState<"imported" | "skipped">("imported");
  const [page, setPage] = useState(0);
  const [problemsOnly, setProblemsOnly] = useState(false);

  const baseName = sourceFileName.replace(/\.csv$/i, "");
  const retryableRows = useMemo(() => getRetryableSkippedRecords(result.skipped), [result.skipped]);

  const importedRows = problemsOnly
    ? result.imported.filter((r) => r.confidence < LOW_CONFIDENCE_THRESHOLD)
    : result.imported;

  const rows = tab === "imported" ? importedRows : result.skipped;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);
  const pageRows = useMemo(
    () => rows.slice(clampedPage * PAGE_SIZE, (clampedPage + 1) * PAGE_SIZE),
    [rows, clampedPage]
  );

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 flex-wrap gap-2">
        <div className="flex items-center gap-1 rounded-[var(--radius-sm)] bg-surface-raised p-0.5 border border-border">
          <button
            onClick={() => {
              setTab("imported");
              setPage(0);
            }}
            className={cn(
              "px-3 py-1.5 rounded-[calc(var(--radius-sm)-2px)] text-[12.5px] font-medium transition-colors",
              tab === "imported" ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
            )}
          >
            Imported ({result.imported.length})
          </button>
          <button
            onClick={() => {
              setTab("skipped");
              setPage(0);
            }}
            className={cn(
              "px-3 py-1.5 rounded-[calc(var(--radius-sm)-2px)] text-[12.5px] font-medium transition-colors",
              tab === "skipped" ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
            )}
          >
            Skipped ({result.skipped.length})
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {tab === "imported" && (
            <button
              onClick={() => {
                setProblemsOnly((v) => !v);
                setPage(0);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-2.5 h-8 text-[12px] font-medium transition-colors",
                problemsOnly
                  ? "border-warning/30 bg-warning-muted text-warning"
                  : "border-border text-muted hover:text-foreground"
              )}
            >
              <Filter className="size-3.5" />
              {`< ${Math.round(LOW_CONFIDENCE_THRESHOLD * 100)}% confidence only`}
            </button>
          )}

          {tab === "skipped" && retryableRows.length > 0 && (
            <Button variant="secondary" size="sm" onClick={onRetryFailedBatches} disabled={isRetrying}>
              <RotateCw className={cn("size-3.5", isRetrying && "animate-spin")} />
              {isRetrying ? "Retrying…" : `Retry ${retryableRows.length} failed row(s)`}
            </Button>
          )}

          {tab === "imported" && result.imported.length > 0 && (
            <div className="flex gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => exportImportedAsCsv(result.imported, `${baseName}-ImportCSV Pro.csv`)}
              >
                <FileText className="size-3.5" />
                CSV
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => exportImportedAsJson(result.imported, `${baseName}-ImportCSV Pro.json`)}
              >
                <FileJson className="size-3.5" />
                JSON
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        {rows.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[13px] text-muted">
              {tab === "imported"
                ? problemsOnly
                  ? "No imported rows are below the confidence threshold — clean batch."
                  : "No records were imported."
                : "Nothing was skipped — clean import."}
            </p>
          </div>
        ) : tab === "imported" ? (
          <ImportedTable rows={pageRows as typeof result.imported} />
        ) : (
          <SkippedTable rows={pageRows as SkippedRecord[]} onManualFix={onManualFix} />
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
        <span className="text-[11px] text-muted-2 font-mono tabular">
          page {clampedPage + 1} / {totalPages}
        </span>
        <div className="flex gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            disabled={clampedPage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Prev
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={clampedPage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ImportedTable({ rows }: { rows: ImportResult["imported"] }) {
  return (
    <table className="w-full text-[12.5px]">
      <thead className="bg-surface-raised">
        <tr>
          {["Name", "Email", "Phone", "Company", "Status", "Source", "Confidence"].map((h) => (
            <th key={h} scope="col" className="px-3 py-2 text-left font-medium text-muted border-b border-border whitespace-nowrap">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.rowIndex} className="hover:bg-surface-raised/60 border-b border-border/60 last:border-0">
            <td className="px-3 py-2 text-foreground/90 whitespace-nowrap">{r.record.name ?? "—"}</td>
            <td className="px-3 py-2 text-foreground/90 whitespace-nowrap">{r.record.email ?? "—"}</td>
            <td className="px-3 py-2 text-foreground/90 whitespace-nowrap font-mono tabular">
              {r.record.country_code ?? ""} {r.record.mobile_without_country_code ?? "—"}
            </td>
            <td className="px-3 py-2 text-foreground/90 whitespace-nowrap">{r.record.company ?? "—"}</td>
            <td className="px-3 py-2 whitespace-nowrap">
              {r.record.crm_status ? <Badge tone="accent">{r.record.crm_status}</Badge> : <span className="text-muted-2">—</span>}
            </td>
            <td className="px-3 py-2 text-muted whitespace-nowrap">{r.record.data_source ?? "—"}</td>
            <td className="px-3 py-2 whitespace-nowrap">
              <Badge tone={confidenceTone(r.confidence)}>{Math.round(r.confidence * 100)}%</Badge>
              {r.warnings.length > 0 && (
                <span title={r.warnings.join("; ")}>
                  <AlertTriangle className="inline-block size-3 ml-1.5 text-warning" aria-label={`Warnings: ${r.warnings.join("; ")}`} />
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SkippedTable({
  rows,
  onManualFix,
}: {
  rows: SkippedRecord[];
  onManualFix: (rowIndex: number, email: string, mobile: string) => void;
}) {
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [mobileDraft, setMobileDraft] = useState("");

  const startEdit = (r: SkippedRecord) => {
    setEditingRow(r.rowIndex);
    setEmailDraft(typeof r.raw.email === "string" ? r.raw.email : "");
    setMobileDraft("");
  };

  return (
    <table className="w-full text-[12.5px]">
      <thead className="bg-surface-raised">
        <tr>
          <th scope="col" className="px-3 py-2 text-left font-medium text-muted-2 border-b border-border w-10">#</th>
          <th scope="col" className="px-3 py-2 text-left font-medium text-muted border-b border-border">Reason</th>
          <th scope="col" className="px-3 py-2 text-left font-medium text-muted border-b border-border">Raw data</th>
          <th scope="col" className="px-3 py-2 text-left font-medium text-muted border-b border-border w-20">Fix</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.rowIndex} className="hover:bg-surface-raised/60 border-b border-border/60 last:border-0 align-top">
            <td className="px-3 py-2 text-muted-2 font-mono tabular">{r.rowIndex + 1}</td>
            <td className="px-3 py-2">
              <Badge tone="danger">{r.reason}</Badge>
            </td>
            <td className="px-3 py-2 text-muted max-w-[380px] font-mono">
              {editingRow === r.rowIndex ? (
                <div className="flex flex-col gap-1.5">
                  <input
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    placeholder="email@example.com"
                    className="rounded-[var(--radius-sm)] border border-border bg-surface px-2 py-1 text-[12px] text-foreground outline-none focus:border-accent"
                  />
                  <input
                    value={mobileDraft}
                    onChange={(e) => setMobileDraft(e.target.value)}
                    placeholder="10-digit mobile"
                    className="rounded-[var(--radius-sm)] border border-border bg-surface px-2 py-1 text-[12px] text-foreground outline-none focus:border-accent"
                  />
                </div>
              ) : (
                <span className="truncate block max-w-[380px]">{JSON.stringify(r.raw)}</span>
              )}
            </td>
            <td className="px-3 py-2">
              {editingRow === r.rowIndex ? (
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      onManualFix(r.rowIndex, emailDraft.trim(), mobileDraft.trim());
                      setEditingRow(null);
                    }}
                    disabled={!emailDraft.trim() && !mobileDraft.trim()}
                    aria-label="Save correction"
                    className="text-success hover:text-success/80 disabled:opacity-30"
                  >
                    <Check className="size-4" />
                  </button>
                  <button
                    onClick={() => setEditingRow(null)}
                    aria-label="Cancel correction"
                    className="text-muted hover:text-foreground cursor-pointer"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => startEdit(r)}
                  aria-label={`Manually add contact info for row ${r.rowIndex + 1}`}
                  className="text-muted hover:text-accent"
                >
                  <Pencil className="size-3.5" />
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DownloadAllHint() {
  return (
    <p className="flex items-center gap-1.5 text-[11px] text-muted-2">
      <Download className="size-3" />
      Exports exclude skipped rows and are sanitized against spreadsheet formula injection.
    </p>
  );
}
