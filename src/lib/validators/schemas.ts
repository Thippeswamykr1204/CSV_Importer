import { z } from "zod";
import { CRM_STATUS_VALUES, DATA_SOURCE_VALUES } from "@/lib/types/crm";

/**
 * Schema for a single mapped record as returned by the AI.
 * Every field is optional/nullable because the model is instructed to
 * leave uncertain fields blank rather than hallucinate a value.
 */
export const aiCrmRecordSchema = z.object({
  created_at: z.string().nullable().optional().default(null),
  name: z.string().nullable().optional().default(null),
  email: z.string().nullable().optional().default(null),
  country_code: z.string().nullable().optional().default(null),
  mobile_without_country_code: z.string().nullable().optional().default(null),
  company: z.string().nullable().optional().default(null),
  city: z.string().nullable().optional().default(null),
  state: z.string().nullable().optional().default(null),
  country: z.string().nullable().optional().default(null),
  lead_owner: z.string().nullable().optional().default(null),
  crm_status: z.enum(CRM_STATUS_VALUES).nullable().optional().default(null),
  crm_note: z.string().nullable().optional().default(null),
  data_source: z.enum(DATA_SOURCE_VALUES).nullable().optional().default(null),
  possession_time: z.string().nullable().optional().default(null),
  description: z.string().nullable().optional().default(null),
});

/**
 * Envelope the model must return for a single batch: one entry per input
 * row (skipped rows are still present with `skip: true` + reason), so we
 * can always reconcile array length against the batch we sent.
 */
export const aiBatchItemSchema = z.object({
  rowIndex: z.number().int().nonnegative(),
  skip: z.boolean().default(false),
  skipReason: z.string().nullable().optional().default(null),
  confidence: z.number().min(0).max(1),
  record: aiCrmRecordSchema,
  warnings: z.array(z.string()).default([]),
});

export const aiBatchResponseSchema = z.object({
  items: z.array(aiBatchItemSchema),
});

export type AiBatchItem = z.infer<typeof aiBatchItemSchema>;
export type AiBatchResponse = z.infer<typeof aiBatchResponseSchema>;

/** Upload constraints, validated on both client and server. */
export const UPLOAD_LIMITS = {
  maxFileSizeBytes: 8 * 1024 * 1024, // 8MB — generous for a lead-list CSV, small enough to keep AI batching sane
  maxRows: 5000,
  allowedMimeTypes: ["text/csv", "application/vnd.ms-excel", "text/plain"],
  allowedExtensions: [".csv"],
};

export const importRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  headers: z.array(z.string()).min(1),
  rows: z
    .array(z.record(z.string(), z.unknown()))
    .min(1)
    .max(UPLOAD_LIMITS.maxRows),
});

export type ImportRequest = z.infer<typeof importRequestSchema>;
