"use client";

import Papa from "papaparse";
import { UPLOAD_LIMITS } from "@/lib/validators/schemas";

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, unknown>[];
  fileName: string;
  fileSizeBytes: number;
}

export interface CsvParseError {
  message: string;
}

export function validateFileBeforeParse(file: File): CsvParseError | null {
  const nameLower = file.name.toLowerCase();
  const hasValidExtension = UPLOAD_LIMITS.allowedExtensions.some((ext) =>
    nameLower.endsWith(ext)
  );

  if (!hasValidExtension) {
    return { message: "Only .csv files are supported." };
  }

  if (file.size === 0) {
    return { message: "This file is empty." };
  }

  if (file.size > UPLOAD_LIMITS.maxFileSizeBytes) {
    const maxMb = (UPLOAD_LIMITS.maxFileSizeBytes / (1024 * 1024)).toFixed(0);
    return { message: `File exceeds the ${maxMb}MB size limit.` };
  }

  return null;
}

export function parseCsvFile(file: File): Promise<ParsedCsv | CsvParseError> {
  // Offload parsing to a worker thread for anything non-trivial in size —
  // Papa Parse's main-thread mode is fine for small files, but a
  // multi-thousand-row CSV can visibly freeze the drop animation and
  // input responsiveness otherwise. 256KB is comfortably past "instant
  // either way" and catches the files where it actually matters.
  const WORKER_THRESHOLD_BYTES = 256 * 1024;

  return new Promise((resolve) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      dynamicTyping: false,
      worker: file.size > WORKER_THRESHOLD_BYTES,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        const headers = (results.meta.fields ?? []).map((h) => h.trim()).filter(Boolean);

        if (headers.length === 0) {
          resolve({ message: "Couldn't detect any column headers in this file." });
          return;
        }

        if (results.data.length === 0) {
          resolve({ message: "This CSV has headers but no data rows." });
          return;
        }

        if (results.data.length > UPLOAD_LIMITS.maxRows) {
          resolve({
            message: `This CSV has ${results.data.length} rows, which exceeds the ${UPLOAD_LIMITS.maxRows}-row limit per import.`,
          });
          return;
        }

        resolve({
          headers,
          rows: results.data,
          fileName: file.name,
          fileSizeBytes: file.size,
        });
      },
      error: (error) => {
        resolve({ message: `Failed to parse CSV: ${error.message}` });
      },
    });
  });
}

export function isParseError(x: ParsedCsv | CsvParseError): x is CsvParseError {
  return "message" in x;
}

/** Single source of truth for the human-readable limits string shown in the UI. */
export const UPLOAD_LIMITS_LABEL = `Max ${(UPLOAD_LIMITS.maxFileSizeBytes / (1024 * 1024)).toFixed(
  0
)}MB, ${UPLOAD_LIMITS.maxRows.toLocaleString()} rows`;
