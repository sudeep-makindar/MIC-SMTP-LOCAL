import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { isValidEmail } from "./validators";

export interface ParsedSpreadsheet {
  columns: string[];
  rows: Record<string, string>[];
}

export function parseSpreadsheet(filePath: string): ParsedSpreadsheet {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".csv") return parseCsv(filePath);
  if (ext === ".xlsx" || ext === ".xls") return parseXlsx(filePath);
  throw new Error(`Unsupported file type: ${ext}. Only .csv and .xlsx are supported.`);
}

function parseCsv(filePath: string): ParsedSpreadsheet {
  let content = fs.readFileSync(filePath, "utf-8");
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
    delimitersToGuess: [",", "\t", "|", ";", Papa.RECORD_SEP, Papa.UNIT_SEP],
  });
  if (result.errors.length > 0) {
    const fatal = result.errors.filter(
      (e) => e.type !== "FieldMismatch" && e.code !== "UndetectableDelimiter"
    );
    if (fatal.length > 0 && (!result.data || result.data.length === 0)) {
      throw new Error(`CSV parse error: ${fatal[0].message}`);
    }
  }
  let columns = (result.meta.fields ?? []).map((c) => c.trim()).filter(Boolean);
  if (columns.length === 0 && result.data && result.data.length > 0) {
    columns = Object.keys(result.data[0]).map((c) => c.trim()).filter(Boolean);
  }
  const rows = (result.data ?? []).map((row) => normalizeRow(row, columns));
  return { columns, rows };
}

function parseXlsx(filePath: string): ParsedSpreadsheet {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  const columns = raw.length > 0 ? Object.keys(raw[0]).map((c) => c.trim()) : [];
  const rows = raw.map((row) => {
    const out: Record<string, string> = {};
    for (const key of Object.keys(row)) {
      out[key.trim()] = row[key] === null || row[key] === undefined ? "" : String(row[key]).trim();
    }
    return normalizeRow(out, columns);
  });
  return { columns, rows };
}

function normalizeRow(row: Record<string, string>, columns: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const col of columns) {
    const v = row[col];
    out[col] = v === undefined || v === null ? "" : String(v).trim();
  }
  return out;
}

const EMAIL_COLUMN_HINTS = [
  "email",
  "emailaddress",
  "email_address",
  "e-mail",
  "mail",
  "recipientemail",
  "contactemail",
  "primaryemail",
];

/** Heuristic email column detection: prefer name matches, fall back to content sniffing. */
export function detectEmailColumn(columns: string[], rows: Record<string, string>[]): string | null {
  const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");
  for (const hint of EMAIL_COLUMN_HINTS) {
    const match = columns.find((c) => normalize(c) === hint);
    if (match) return match;
  }
  const partial = columns.find((c) => normalize(c).includes("email") || normalize(c).includes("mail"));
  if (partial) return partial;

  // Content sniffing fallback: pick the column with the highest proportion of valid-looking emails.
  const sample = rows.slice(0, 50);
  if (sample.length === 0) return null;
  let best: { column: string; score: number } | null = null;
  for (const col of columns) {
    const values = sample.map((r) => r[col]).filter(Boolean);
    if (values.length === 0) continue;
    const validCount = values.filter((v) => isValidEmail(v)).length;
    const score = validCount / values.length;
    if (score > 0.5 && (!best || score > best.score)) {
      best = { column: col, score };
    }
  }
  return best?.column ?? null;
}
