/**
 * Converts a normal, shareable Google Sheets URL (the kind a user
 * actually has copied in their clipboard —
 * https://docs.google.com/spreadsheets/d/<id>/edit?gid=<gid>#gid=<gid>)
 * into the CSV export endpoint for that same sheet/tab. Returns null if
 * the URL isn't a recognizable Google Sheets link, so the caller can
 * fall back to treating it as a plain CSV URL instead.
 */
export function toGoogleSheetsCsvExportUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!url.hostname.endsWith("docs.google.com")) return null;

  const match = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return null;

  const sheetId = match[1];
  const gid = url.searchParams.get("gid") ?? url.hash.match(/gid=(\d+)/)?.[1] ?? "0";

  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}