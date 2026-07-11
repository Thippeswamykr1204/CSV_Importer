/**
 * Domain model for GrowEasy CRM records.
 *
 * This is the single source of truth for the target shape. Every layer
 * (AI schema, validators, services, UI) derives from these constants so
 * the enum lists only ever live in one place.
 */

export const CRM_STATUS_VALUES = [
  "GOOD_LEAD_FOLLOW_UP",
  "DID_NOT_CONNECT",
  "BAD_LEAD",
  "SALE_DONE",
] as const;

export type CrmStatus = (typeof CRM_STATUS_VALUES)[number];

export const DATA_SOURCE_VALUES = [
  "leads_on_demand",
  "meridian_tower",
  "eden_park",
  "varah_swamy",
  "sarjapur_plots",
] as const;

export type DataSource = (typeof DATA_SOURCE_VALUES)[number];

/**
 * A single row in the GrowEasy CRM target format.
 * Every field except `name` is nullable — the AI is instructed to leave
 * a field blank rather than guess when it isn't confident.
 */
export interface CrmRecord {
  created_at: string | null;
  name: string | null;
  email: string | null;
  country_code: string | null;
  mobile_without_country_code: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  lead_owner: string | null;
  crm_status: CrmStatus | null;
  crm_note: string | null;
  data_source: DataSource | null;
  possession_time: string | null;
  description: string | null;
}

export const CRM_FIELDS = [
  "created_at",
  "name",
  "email",
  "country_code",
  "mobile_without_country_code",
  "company",
  "city",
  "state",
  "country",
  "lead_owner",
  "crm_status",
  "crm_note",
  "data_source",
  "possession_time",
  "description",
] as const satisfies readonly (keyof CrmRecord)[];

/** A mapped record enriched with per-row AI mapping metadata for the UI. */
export interface MappedRecord {
  rowIndex: number;
  record: CrmRecord;
  confidence: number; // 0-1
  warnings: string[];
}

export interface SkippedRecord {
  rowIndex: number;
  raw: Record<string, unknown>;
  reason: string;
}

export interface ImportStats {
  totalRecords: number;
  importedRecords: number;
  skippedRecords: number;
  averageConfidence: number;
  processingTimeMs: number;
  batchesProcessed: number;
  batchesFailed: number;
  retriedBatches: number;
}

export interface ImportResult {
  stats: ImportStats;
  imported: MappedRecord[];
  skipped: SkippedRecord[];
}

/** Stages surfaced to the UI during an import run. */
export const IMPORT_STAGES = [
  "uploading",
  "parsing",
  "batching",
  "mapping",
  "validating",
  "finalizing",
  "done",
] as const;

export type ImportStage = (typeof IMPORT_STAGES)[number];

export interface StageEvent {
  type: "stage";
  stage: ImportStage;
  message: string;
  progress: number; // 0-100 overall
}

export interface BatchEvent {
  type: "batch";
  batchIndex: number;
  totalBatches: number;
  status: "started" | "completed" | "retrying" | "failed";
  recordsInBatch: number;
}

export interface ResultEvent {
  type: "result";
  result: ImportResult;
}

export interface ErrorEvent {
  type: "error";
  message: string;
}

export type ImportStreamEvent = StageEvent | BatchEvent | ResultEvent | ErrorEvent;
