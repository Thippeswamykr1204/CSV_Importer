"use client";

import type { ImportStats } from "@/lib/types/crm";

const STORAGE_KEY = "groweasy.import-history.v1";
const MAX_ENTRIES = 20;

export interface ImportHistoryEntry {
  id: string;
  fileName: string;
  timestamp: number;
  stats: ImportStats;
}

/**
 * Import history is stored in the browser only — there is no server-side
 * persistence anywhere in this project (see README: "Why no database").
 * Deliberately more restrictive than "just cache the result": only
 * aggregate stats are saved (counts, confidence, timing), never the
 * actual imported records. The imported records contain real lead PII
 * (names, emails, phone numbers) — persisting that indefinitely in
 * localStorage, un-encrypted, with no expiry or access control, would be
 * a real data-handling problem even for a demo. A history of "what
 * happened" doesn't need "what the data was."
 */
export function getImportHistory(): ImportHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addImportHistoryEntry(fileName: string, stats: ImportStats): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getImportHistory();
    const entry: ImportHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fileName,
      timestamp: Date.now(),
      stats,
    };
    const next = [entry, ...existing].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage can fail (quota, private browsing) — history is a nice-to-have,
    // never worth surfacing an error over.
  }
}

export function clearImportHistory(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}