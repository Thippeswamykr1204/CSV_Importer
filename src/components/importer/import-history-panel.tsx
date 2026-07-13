"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge, confidenceTone } from "@/components/ui/badge";
import { clearImportHistory, getImportHistory } from "@/lib/utils/history";

interface ImportHistoryPanelProps {
  open: boolean;
  onClose: () => void;
  /** Bumped by the parent every time a new import finishes, so this panel
   * re-reads localStorage instead of holding its own stale copy. */
  refreshKey: number;
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

export function ImportHistoryPanel({ open, onClose, refreshKey }: ImportHistoryPanelProps) {
  const [clearedAt, setClearedAt] = useState(0);

  // Re-reads localStorage whenever the panel opens, a new import
  // finishes (refreshKey), or the user clears history — a derived
  // value computed during render rather than state synced via an
  // effect, since the read itself is synchronous and side-effect-free.
  const entries = useMemo(
    () => (open ? getImportHistory() : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, refreshKey, clearedAt]
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import history"
      description="Stored in this browser only — no data leaves your device for this."
      widthClassName="max-w-lg"
    >
      {entries.length === 0 ? (
        <div className="py-10 text-center">
          <FileSpreadsheet className="size-6 text-muted-2 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-[13px] text-muted">No imports yet on this browser.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-surface-raised px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-[12.5px] font-medium text-foreground truncate">{entry.fileName}</p>
                <p className="text-[11px] text-muted-2 mt-0.5">{formatRelativeTime(entry.timestamp)}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge tone="success">{entry.stats.importedRecords} imported</Badge>
                {entry.stats.skippedRecords > 0 && (
                  <Badge tone="danger">{entry.stats.skippedRecords} skipped</Badge>
                )}
                <Badge tone={confidenceTone(entry.stats.averageConfidence)}>
                  {Math.round(entry.stats.averageConfidence * 100)}%
                </Badge>
              </div>
            </div>
          ))}

          <div className="pt-2 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearImportHistory();
                setClearedAt(Date.now());
              }}
            >
              <Trash2 className="size-3.5" />
              Clear history
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}