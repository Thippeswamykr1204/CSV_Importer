import Papa from "papaparse";
import { CRM_FIELDS } from "@/lib/types/crm";
import type { MappedRecord } from "@/lib/types/crm";
import { sanitizeRecordForCsvExport } from "@/lib/security/sanitize";

function downloadBlob(content: string, mimeType: string, filename: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportImportedAsJson(records: MappedRecord[], fileName: string) {
  const payload = records.map((r) => r.record);
  downloadBlob(JSON.stringify(payload, null, 2), "application/json", fileName);
}

export function exportImportedAsCsv(records: MappedRecord[], fileName: string) {
  const rows = records.map((r) =>
    sanitizeRecordForCsvExport(r.record as unknown as Record<string, unknown>)
  );
  const csv = Papa.unparse(rows, { columns: [...CRM_FIELDS] });
  downloadBlob(csv, "text/csv;charset=utf-8", fileName);
}
