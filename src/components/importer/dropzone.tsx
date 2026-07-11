"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  Download,
  FileSpreadsheet,
  Loader2,
  FolderOpen,
  FileText,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { InlineAlert } from "@/components/ui/inline-alert";
import {
  isParseError,
  parseCsvFile,
  validateFileBeforeParse,
  UPLOAD_LIMITS_LABEL,
  type ParsedCsv,
} from "@/lib/utils/csv-client";

interface DropzoneProps {
  onParsed: (result: ParsedCsv) => void;
}

type SelectionState =
  | { status: "idle" }
  | { status: "reading"; fileName: string; fileSizeBytes: number }
  | { status: "error"; message: string };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function Dropzone({ onParsed }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selection, setSelection] = useState<SelectionState>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (fileList: FileList) => {
      // Flatfile/Dromo both treat "more than one file" as a distinct,
      // explicitly-messaged case rather than silently picking one —
      // silent partial-acceptance is exactly the anti-pattern that
      // erodes trust in an import tool.
      if (fileList.length > 1) {
        setSelection({
          status: "error",
          message: `You dropped ${fileList.length} files, but only one CSV can be imported at a time. Drop a single file to continue.`,
        });
        return;
      }

      const file = fileList[0];
      if (!file) return;

      const preValidationError = validateFileBeforeParse(file);
      if (preValidationError) {
        setSelection({ status: "error", message: preValidationError.message });
        return;
      }

      setSelection({ status: "reading", fileName: file.name, fileSizeBytes: file.size });
      const result = await parseCsvFile(file);

      if (isParseError(result)) {
        setSelection({ status: "error", message: result.message });
        return;
      }

      onParsed(result);
    },
    [onParsed]
  );

  const isReading = selection.status === "reading";

  return (
    <div className="w-full">
      <motion.div
        onDragOver={(e) => {
          e.preventDefault();
          if (!isReading) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (isReading) return;
          if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !isReading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!isReading && (e.key === "Enter" || e.key === " ")) inputRef.current?.click();
        }}
        role="button"
        tabIndex={0}
        aria-label="Upload CSV file"
        aria-describedby="upload-hint"
        aria-busy={isReading}
        className={cn(
          "relative flex flex-col items-center justify-center gap-5 rounded-[var(--radius-lg)] border border-dashed px-8 py-20 text-center transition-colors duration-150",
          isReading ? "cursor-default" : "cursor-pointer",
          isDragging
            ? "border-accent bg-accent-muted/40"
            : "border-border hover:border-border-hover bg-surface"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <AnimatePresence mode="wait">
          {isReading ? (
            <motion.div
              key="reading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="flex size-16 items-center justify-center rounded-[var(--radius-lg)] border border-accent/30 bg-accent/10 shadow-[0_0_40px_-8px_var(--accent)]">
                <Loader2 className="size-6 text-accent animate-spin" />
              </div>
              <div>
                <div className="flex items-center justify-center gap-1.5 text-[15px] font-medium text-foreground">
                  <FileSpreadsheet className="size-4 text-muted" />
                  {selection.status === "reading" ? selection.fileName : ""}
                </div>
                <p className="text-[12.5px] text-muted mt-1.5 font-mono tabular">
                  {selection.status === "reading" ? formatBytes(selection.fileSizeBytes) : ""}
                  {" · "}reading and validating…
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-5"
            >
              <div
                className={cn(
                  "flex size-16 items-center justify-center rounded-[var(--radius-lg)] border transition-colors duration-200",
                  isDragging
                    ? "border-accent bg-accent/10 shadow-[0_0_48px_-6px_var(--accent)]"
                    : "border-accent/25 bg-accent/[0.06] shadow-[0_0_32px_-10px_var(--accent)]"
                )}
              >
                <UploadCloud
                  className={cn("size-7", isDragging ? "text-accent" : "text-accent/80")}
                  strokeWidth={1.75}
                />
              </div>

              <div>
                <p className="text-[16px] font-medium text-foreground">
                  {isDragging ? "Drop it" : "Drop your CSV file here"}
                </p>
                <p className="text-[12.5px] text-muted-2 mt-1">or</p>
              </div>

              <span
                className="pointer-events-none inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-accent px-5 h-10 text-[13.5px] font-medium text-white shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset]"
              >
                <FolderOpen className="size-4" />
                Browse files
              </span>

              <p id="upload-hint" className="text-[12px] text-muted max-w-sm leading-relaxed">
                Any export — HubSpot, Salesforce, Zoho, Facebook Lead Ads, spreadsheets.
                <br />
                {UPLOAD_LIMITS_LABEL}.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {selection.status === "error" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 overflow-hidden"
          >
            <InlineAlert
              message={selection.message}
              onDismiss={() => setSelection({ status: "idle" })}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alternate import sources — visually planned, not yet built. Marked
          "Soon" and disabled rather than wired to a fake success state:
          a button that looks functional but silently does nothing is
          worse than one that's honestly unavailable. */}
      <div className="mt-8 flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] text-muted-2">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="mt-4 grid sm:grid-cols-2 gap-3">
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Coming soon"
          className="relative flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-4 h-11 text-[13px] font-medium text-muted-2 cursor-not-allowed"
        >
          <FileText className="size-4" />
          Import from Google Sheets
          <span className="absolute top-1.5 right-2 rounded-full bg-surface-raised border border-border px-1.5 py-0.5 text-[9px] text-muted-2 tracking-wide">
            SOON
          </span>
        </button>
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Coming soon"
          className="relative flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-4 h-11 text-[13px] font-medium text-muted-2 cursor-not-allowed"
        >
          <Link2 className="size-4" />
          Import from URL
          <span className="absolute top-1.5 right-2 rounded-full bg-surface-raised border border-border px-1.5 py-0.5 text-[9px] text-muted-2 tracking-wide">
            SOON
          </span>
        </button>
      </div>

      <div className="mt-4 flex justify-center">
        <a
          href="/api/sample-csv"
          download
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 h-8 text-[13px] font-medium text-accent hover:text-accent-hover hover:bg-surface-raised transition-colors"
        >
          <Download className="size-3.5" />
          Download sample CSV
        </a>
      </div>
    </div>
  );
}