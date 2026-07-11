/**
 * Best-effort repair for near-JSON text returned by the model despite
 * strict-JSON instructions. Models occasionally wrap output in markdown
 * fences, add a trailing comma, or emit leading/trailing prose. This is
 * intentionally conservative — it fixes common, safe patterns and gives
 * up (returns null) rather than risk silently corrupting data.
 */
export function repairAndParseJson(raw: string): unknown | null {
  const attempts: Array<(s: string) => string> = [
    (s) => s.trim(),
    (s) => stripMarkdownFences(s),
    (s) => extractOutermostJsonObject(s),
    (s) => removeTrailingCommas(s),
  ];

  let candidate = raw;
  for (const transform of attempts) {
    candidate = transform(candidate);
    const parsed = tryParse(candidate);
    if (parsed !== null) return parsed;
  }

  return null;
}

function tryParse(s: string): unknown | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function stripMarkdownFences(s: string): string {
  return s
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function extractOutermostJsonObject(s: string): string {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return s;
  return s.slice(start, end + 1);
}

function removeTrailingCommas(s: string): string {
  return s.replace(/,\s*([}\]])/g, "$1");
}
