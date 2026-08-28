import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { SendLogEntry, RecipientStatus, FailureCategory, SendingMode } from "../../shared/types";

interface SendLogRow {
  id: string;
  timestamp: string;
  campaign_id: string | null;
  campaign_name: string | null;
  sender: string | null;
  recipient: string;
  subject: string | null;
  status: string;
  failure_reason: string | null;
  failure_category: string | null;
  attempt_number: number;
  template: string | null;
  attachment_info: string | null;
  sending_mode: string | null;
}

function rowToEntry(r: SendLogRow): SendLogEntry {
  return {
    id: r.id,
    timestamp: r.timestamp,
    campaignId: r.campaign_id ?? "",
    campaignName: r.campaign_name ?? "",
    sender: r.sender ?? "",
    recipient: r.recipient,
    subject: r.subject ?? "",
    status: r.status as RecipientStatus,
    failureReason: r.failure_reason,
    failureCategory: r.failure_category as FailureCategory | null,
    attemptNumber: r.attempt_number,
    template: r.template,
    attachmentInfo: r.attachment_info,
    sendingMode: (r.sending_mode ?? "automatic") as SendingMode,
  };
}

export interface NewLogEntry {
  campaignId: string;
  campaignName: string;
  sender: string;
  recipient: string;
  subject: string;
  status: RecipientStatus;
  failureReason?: string | null;
  failureCategory?: FailureCategory | null;
  attemptNumber: number;
  template?: string | null;
  attachmentInfo?: string | null;
  sendingMode: SendingMode;
}

export function appendLogEntry(entry: NewLogEntry): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO send_log (id, timestamp, campaign_id, campaign_name, sender, recipient, subject, status,
       failure_reason, failure_category, attempt_number, template, attachment_info, sending_mode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    uuid(),
    new Date().toISOString(),
    entry.campaignId,
    entry.campaignName,
    entry.sender,
    entry.recipient,
    entry.subject,
    entry.status,
    entry.failureReason ?? null,
    entry.failureCategory ?? null,
    entry.attemptNumber,
    entry.template ?? null,
    entry.attachmentInfo ?? null,
    entry.sendingMode
  );
}

export interface LogSearchFilters {
  email?: string;
  campaignId?: string;
  subject?: string;
  status?: RecipientStatus;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export function searchLog(filters: LogSearchFilters): SendLogEntry[] {
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (filters.email) {
    clauses.push("recipient LIKE ?");
    values.push(`%${filters.email}%`);
  }
  if (filters.campaignId) {
    clauses.push("campaign_id = ?");
    values.push(filters.campaignId);
  }
  if (filters.subject) {
    clauses.push("subject LIKE ?");
    values.push(`%${filters.subject}%`);
  }
  if (filters.status) {
    clauses.push("status = ?");
    values.push(filters.status);
  }
  if (filters.dateFrom) {
    clauses.push("timestamp >= ?");
    values.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    clauses.push("timestamp <= ?");
    values.push(filters.dateTo);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = filters.limit ?? 200;
  const offset = filters.offset ?? 0;
  const rows = getDb()
    .prepare(`SELECT * FROM send_log ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`)
    .all(...(values as (string | number | null)[]), limit, offset) as unknown as SendLogRow[];
  return rows.map(rowToEntry);
}

export function getRecipientHistory(email: string): SendLogEntry[] {
  const rows = getDb()
    .prepare(`SELECT * FROM send_log WHERE recipient = ? ORDER BY timestamp DESC`)
    .all(email) as unknown as SendLogRow[];
  return rows.map(rowToEntry);
}

/** Emails that received a SENT log entry within the given window, for the recency-protection check. */
export function getRecentlyContactedEmails(emails: string[], hours: number): Set<string> {
  if (emails.length === 0) return new Set();
  const db = getDb();
  const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const placeholders = emails.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT DISTINCT recipient FROM send_log WHERE status = 'sent' AND timestamp >= ? AND recipient IN (${placeholders})`
    )
    .all(cutoff, ...emails) as { recipient: string }[];
  return new Set(rows.map((r) => r.recipient));
}

export function getMasterStats(): { totalSent: number; totalFailed: number } {
  const db = getDb();
  const totalSent = (db.prepare(`SELECT COUNT(*) c FROM send_log WHERE status = 'sent'`).get() as { c: number }).c;
  const totalFailed = (db.prepare(`SELECT COUNT(*) c FROM send_log WHERE status = 'failed'`).get() as { c: number }).c;
  return { totalSent, totalFailed };
}
