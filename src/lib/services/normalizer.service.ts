import type { AiBatchItem } from "@/lib/validators/schemas";
import type { CrmRecord, MappedRecord, SkippedRecord } from "@/lib/types/crm";

/**
 * The AI is instructed to skip rows with no email/phone and to enforce
 * the enum constraints — but we never trust an LLM as the sole
 * enforcement point for a business rule. This layer re-validates the
 * hard constraints deterministically so a prompt regression or a model
 * hiccup can't silently violate them.
 */
export function normalizeBatchItem(
  item: AiBatchItem,
  raw: Record<string, unknown>
): { kind: "imported"; record: MappedRecord } | { kind: "skipped"; record: SkippedRecord } {
  const record = trimRecord(item.record);
  const hasEmail = Boolean(record.email && record.email.trim().length > 0);
  const hasMobile = Boolean(
    record.mobile_without_country_code && record.mobile_without_country_code.trim().length > 0
  );

  if (item.skip || (!hasEmail && !hasMobile)) {
    return {
      kind: "skipped",
      record: {
        rowIndex: item.rowIndex,
        raw,
        reason:
          item.skipReason?.trim() ||
          "Record has neither an email address nor a phone number.",
      },
    };
  }

  return {
    kind: "imported",
    record: {
      rowIndex: item.rowIndex,
      record,
      confidence: clamp01(item.confidence),
      warnings: item.warnings,
    },
  };
}

function trimRecord(record: CrmRecord): CrmRecord {
  const out = { ...record };
  for (const key of Object.keys(out) as (keyof CrmRecord)[]) {
    const value = out[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      (out as Record<string, string | null>)[key] = trimmed.length > 0 ? trimmed : null;
    }
  }
  return out;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
