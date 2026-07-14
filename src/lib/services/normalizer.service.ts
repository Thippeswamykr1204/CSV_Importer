import type { AiBatchItem } from "@/lib/validators/schemas";
import type { CrmRecord, MappedRecord, SkippedRecord } from "@/lib/types/crm";
import { CRM_FIELDS } from "@/lib/types/crm";

/**
 * Deterministic re-enforcement of business rules on top of the AI's
 * output (see README §6). The model is instructed to already apply
 * these rules, but a hard business rule should never rely solely on an
 * LLM following instructions — this is the ground-truth check.
 */

export type NormalizeOutcome =
  | { kind: "imported"; record: MappedRecord }
  | { kind: "skipped"; record: SkippedRecord };

const DEFAULT_SKIP_REASON = "No email or phone number found for this row.";

function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim().length === 0;
}

function trimField(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function trimRecord(record: CrmRecord): CrmRecord {
  const trimmed = { ...record };
  for (const field of CRM_FIELDS) {
    const value = trimmed[field];
    if (typeof value === "string") {
      (trimmed as Record<string, unknown>)[field] = trimField(value);
    }
  }
  return trimmed;
}

function clampConfidence(confidence: number): number {
  if (Number.isNaN(confidence)) return 0;
  return Math.min(1, Math.max(0, confidence));
}

export function normalizeBatchItem(
  item: AiBatchItem,
  raw: Record<string, unknown>
): NormalizeOutcome {
  const record = trimRecord(item.record);

  const hasEmail = !isBlank(record.email);
  const hasPhone = !isBlank(record.mobile_without_country_code);

  // The AI is told to skip when there's no email/phone, but this rule
  // is too important to trust to the model alone — re-check it here
  // regardless of what `item.skip` says.
  if (!hasEmail && !hasPhone) {
    console.log("[DEBUG] Skipped — no email/phone. Raw record from AI:", record);
    return {
      kind: "skipped",
      record: {
        rowIndex: item.rowIndex,
        raw,
        reason: item.skip ? item.skipReason ?? DEFAULT_SKIP_REASON : DEFAULT_SKIP_REASON,
      },
    };
  }

  if (item.skip) {
    return {
      kind: "skipped",
      record: {
        rowIndex: item.rowIndex,
        raw,
        reason: item.skipReason ?? DEFAULT_SKIP_REASON,
      },
    };
  }

  return {
    kind: "imported",
    record: {
      rowIndex: item.rowIndex,
      record,
      confidence: clampConfidence(item.confidence),
      warnings: item.warnings,
    },
  };
}