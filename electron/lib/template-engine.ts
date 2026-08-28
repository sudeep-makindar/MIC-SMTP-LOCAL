// Placeholder syntax: {{name}}. Detection and rendering used for subject,
// HTML body, and plain-text body alike.

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function detectPlaceholders(...texts: (string | null | undefined)[]): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    let m: RegExpExecArray | null;
    const re = new RegExp(PLACEHOLDER_RE);
    while ((m = re.exec(text)) !== null) {
      found.add(m[1]);
    }
  }
  return Array.from(found).sort();
}

export interface RenderResult {
  text: string;
  missing: string[];
}

/**
 * Replace {{placeholder}} tokens using the mapping placeholder -> column name,
 * then look up the column's value in the recipient's row data.
 * A placeholder with no mapping, or a mapped column with an empty/absent
 * value, is reported in `missing` rather than silently left blank.
 */
export function renderTemplate(
  text: string,
  placeholderMapping: Record<string, string>,
  rowData: Record<string, string>
): RenderResult {
  const missing: string[] = [];
  const rendered = text.replace(PLACEHOLDER_RE, (_full, placeholder: string) => {
    const column = placeholderMapping[placeholder];
    if (!column) {
      missing.push(placeholder);
      return "";
    }
    const value = rowData[column];
    if (value === undefined || value === null || String(value).trim() === "") {
      missing.push(placeholder);
      return "";
    }
    return String(value);
  });
  return { text: rendered, missing: Array.from(new Set(missing)) };
}

/** Suggest a column for a placeholder using simple normalization (case/underscore/space insensitive). */
export function autoMapPlaceholder(placeholder: string, columns: string[]): string | null {
  const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");
  const target = normalize(placeholder);
  let exact = columns.find((c) => normalize(c) === target);
  if (exact) return exact;
  // common aliases
  const aliases: Record<string, string[]> = {
    name: ["fullname", "recipientname", "participantname"],
    email: ["emailaddress", "mail", "e-mail"],
  };
  const aliasTargets = aliases[target] ?? [];
  exact = columns.find((c) => aliasTargets.includes(normalize(c)));
  if (exact) return exact;
  // partial containment as a last resort
  const partial = columns.find((c) => normalize(c).includes(target) || target.includes(normalize(c)));
  return partial ?? null;
}
