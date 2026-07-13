"use client";

import { useState } from "react";
import { Loader2, Link2, FileText } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { parseCsvText, isParseError, type ParsedCsv } from "@/lib/utils/csv-client";

interface ImportFromUrlDialogProps {
  open: boolean;
  onClose: () => void;
  onParsed: (result: ParsedCsv) => void;
  mode: "google-sheets" | "generic-url";
}

const COPY = {
  "google-sheets": {
    title: "Import from Google Sheets",
    description: "Paste a shareable link to a Google Sheet.",
    placeholder: "https://docs.google.com/spreadsheets/d/…",
    icon: FileText,
    hint: 'The sheet must be shared as "Anyone with the link can view."',
  },
  "generic-url": {
    title: "Import from URL",
    description: "Paste a direct link to a publicly accessible CSV file.",
    placeholder: "https://example.com/leads.csv",
    icon: Link2,
    hint: "The URL must be publicly reachable and return a CSV file.",
  },
} as const;

export function ImportFromUrlDialog({ open, onClose, onParsed, mode }: ImportFromUrlDialogProps) {
  const [url, setUrl] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[mode];

  const handleClose = () => {
    if (isFetching) return;
    setUrl("");
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    setIsFetching(true);
    setError(null);

    try {
      const response = await fetch("/api/fetch-remote-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error?.message ?? `Could not fetch that URL (${response.status}).`);
      }

      const { fileName, csvText } = body as { fileName: string; csvText: string };
      const parsed = await parseCsvText(csvText, fileName);

      if (isParseError(parsed)) {
        setError(parsed.message);
        return;
      }

      setUrl("");
      onParsed(parsed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong fetching that URL.");
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={copy.title} description={copy.description}>
      <div className="space-y-3">
        <label htmlFor="remote-csv-url" className="sr-only">
          {copy.title} URL
        </label>
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface-raised px-3 h-10 focus-within:border-accent transition-colors">
          <copy.icon className="size-4 text-muted-2 shrink-0" />
          <input
            id="remote-csv-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isFetching) handleSubmit();
            }}
            placeholder={copy.placeholder}
            disabled={isFetching}
            autoFocus
            className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-2 outline-none disabled:opacity-50"
          />
        </div>

        <p className="text-[11.5px] text-muted-2">{copy.hint}</p>

        {error && <InlineAlert message={error} onDismiss={() => setError(null)} />}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={isFetching}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} disabled={isFetching || !url.trim()}>
            {isFetching ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Fetching…
              </>
            ) : (
              "Import"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}