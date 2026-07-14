"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Search, FileSpreadsheet, Rows3, Columns3, HardDrive, Sparkles, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ParsedCsv } from "@/lib/utils/csv-client";

const PAGE_SIZE = 25;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface PreviewTableProps {
  data: ParsedCsv;
  onConfirm: () => void;
  onReset: () => void;
  isSubmitting: boolean;
}

export function PreviewTable({ data, onConfirm, onReset, isSubmitting }: PreviewTableProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  // Search filters against potentially thousands of rows on every
  // keystroke. useDeferredValue lets React keep the input itself snappy
  // by deprioritizing the (more expensive) filtered re-render, rather
  // than a manual debounce timer that would add latency to every user,
  // even ones on fast rows counts.
  const deferredSearch = useDeferredValue(search);

  const filteredRows = useMemo(() => {
    if (!deferredSearch.trim()) return data.rows;
    const q = deferredSearch.toLowerCase();
    return data.rows.filter((row) =>
      Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [data.rows, deferredSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);
  const pageRows = filteredRows.slice(clampedPage * PAGE_SIZE, (clampedPage + 1) * PAGE_SIZE);

  const stats = [
    { label: "Rows", value: data.rows.length.toLocaleString(), icon: Rows3 },
    { label: "Columns", value: data.headers.length.toString(), icon: Columns3 },
    { label: "File size", value: formatBytes(data.fileSizeBytes), icon: HardDrive },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] bg-surface-raised border border-border">
            <FileSpreadsheet className="size-4 text-muted" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-foreground leading-tight">{data.fileName}</p>
            <p className="text-[11px] text-muted">Parsed locally — nothing sent to AI yet</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 text-[12px] text-muted">
              <s.icon className="size-3.5" />
              <span className="font-mono tabular text-foreground">{s.value}</span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <Card>
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <Search className="size-3.5 text-muted-2" />
          <label htmlFor="preview-search" className="sr-only">
            Search rows
          </label>
          <input
            id="preview-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search rows…"
            className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-2 outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Clear search" className="cursor-pointer">
              <X className="size-3.5 text-muted-2 hover:text-foreground" />
            </button>
          )}
          <span aria-live="polite" className="text-[11px] text-muted-2 font-mono tabular shrink-0">
            {filteredRows.length.toLocaleString()} match{filteredRows.length === 1 ? "" : "es"}
          </span>
        </div>

        <div className="overflow-x-auto">
          {pageRows.length === 0 ? (
            <div className="py-16 text-center">
              <Search className="size-6 text-muted-2 mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-[13px] text-muted">No rows match &ldquo;{search}&rdquo;</p>
            </div>
          ) : (
            <table className="w-full text-[12.5px]">
              <caption className="sr-only">
                Preview of {data.fileName}, showing rows {clampedPage * PAGE_SIZE + 1} to{" "}
                {clampedPage * PAGE_SIZE + pageRows.length} of {filteredRows.length}
              </caption>
              <thead className="sticky top-0 z-10 bg-surface-raised">
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-20 bg-surface-raised px-3 py-2 text-left font-medium text-muted-2 border-b border-r border-border w-10"
                  >
                    #
                  </th>
                  {data.headers.map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="px-3 py-2 text-left font-medium text-muted border-b border-border whitespace-nowrap max-w-[220px]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, i) => (
                  <tr key={clampedPage * PAGE_SIZE + i} className="group hover:bg-surface-raised/60 border-b border-border/60 last:border-0">
                    <td className="sticky left-0 z-10 bg-surface group-hover:bg-[#141419] px-3 py-2 text-muted-2 font-mono tabular border-r border-border">
                      {clampedPage * PAGE_SIZE + i + 1}
                    </td>
                    {data.headers.map((h) => (
                      <td key={h} className="px-3 py-2 text-foreground/90 max-w-[280px] truncate">
                        {String(row[h] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
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

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="md" onClick={onReset} disabled={isSubmitting}>
          Choose a different file
        </Button>
        <Button variant="primary" size="lg" onClick={onConfirm} disabled={isSubmitting}>
          <Sparkles className="size-4" />
          Import with AI
        </Button>
      </div>
    </div>
  );
}
