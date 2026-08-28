import fs from "node:fs";

// Pragmatic RFC5322-ish email validation - good enough to catch operator
// data-entry mistakes without being a full grammar implementation.
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  return EMAIL_RE.test(email.trim());
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Splits a comma/semicolon-separated CC or BCC field into individual addresses. */
export function splitEmailList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface DuplicateReport {
  duplicateIndices: number[]; // row indices considered duplicates (all but the first occurrence)
  duplicateGroups: Map<string, number[]>; // key -> row indices
}

export function findDuplicateEmails(rows: { rowIndex: number; email: string }[]): DuplicateReport {
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const key = normalizeEmail(row.email);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row.rowIndex);
  }
  const duplicateIndices: number[] = [];
  const duplicateGroups = new Map<string, number[]>();
  for (const [key, indices] of groups) {
    if (indices.length > 1) {
      duplicateGroups.set(key, indices);
      duplicateIndices.push(...indices.slice(1));
    }
  }
  return { duplicateIndices, duplicateGroups };
}

export function findDuplicateColumnValues(
  rows: { rowIndex: number; value: string }[]
): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const key = row.value.trim().toLowerCase();
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row.rowIndex);
  }
  const dupes = new Map<string, number[]>();
  for (const [key, indices] of groups) {
    if (indices.length > 1) dupes.set(key, indices);
  }
  return dupes;
}

export function attachmentExists(path: string): boolean {
  try {
    return fs.existsSync(path) && fs.statSync(path).isFile();
  } catch {
    return false;
  }
}
