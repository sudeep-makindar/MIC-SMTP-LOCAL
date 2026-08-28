import { v4 as uuid } from "uuid";
import { getDb, withTransaction } from "./index";
import type { Recipient, RecipientStatus, FailureCategory } from "../../shared/types";

interface RecipientRow {
  id: string;
  campaign_id: string;
  row_index: number;
  data: string;
  email: string;
  status: string;
  attachment_path: string | null;
  error_reason: string | null;
  failure_category: string | null;
  attempts: number;
  last_attempt_at: string | null;
  sent_at: string | null;
  is_duplicate: number;
  is_excluded_recent: number;
}

function rowToRecipient(r: RecipientRow): Recipient {
  return {
    id: r.id,
    campaignId: r.campaign_id,
    rowIndex: r.row_index,
    data: JSON.parse(r.data || "{}"),
    email: r.email,
    status: r.status as RecipientStatus,
    attachmentPath: r.attachment_path,
    errorReason: r.error_reason,
    failureCategory: r.failure_category as FailureCategory | null,
    attempts: r.attempts,
    lastAttemptAt: r.last_attempt_at,
    sentAt: r.sent_at,
    isDuplicate: !!r.is_duplicate,
    isExcludedRecent: !!r.is_excluded_recent,
  };
}

export interface NewRecipient {
  rowIndex: number;
  data: Record<string, string>;
  email: string;
  attachmentPath?: string | null;
  isDuplicate?: boolean;
}

export function bulkInsertRecipients(campaignId: string, recipients: NewRecipient[]): void {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO recipients (id, campaign_id, row_index, data, email, status, attachment_path, is_duplicate)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
  );
  withTransaction(() => {
    for (const item of recipients) {
      stmt.run(
        uuid(),
        campaignId,
        item.rowIndex,
        JSON.stringify(item.data),
        item.email,
        item.attachmentPath ?? null,
        item.isDuplicate ? 1 : 0
      );
    }
  });
}

export function replaceRecipients(campaignId: string, recipients: NewRecipient[]): void {
  const db = getDb();
  withTransaction(() => {
    db.prepare(`DELETE FROM recipients WHERE campaign_id = ?`).run(campaignId);
  });
  bulkInsertRecipients(campaignId, recipients);
}

export function listRecipients(campaignId: string): Recipient[] {
  const rows = getDb()
    .prepare(`SELECT * FROM recipients WHERE campaign_id = ? ORDER BY row_index ASC`)
    .all(campaignId) as unknown as RecipientRow[];
  return rows.map(rowToRecipient);
}

export function countRecipients(campaignId: string): number {
  const row = getDb().prepare(`SELECT COUNT(*) as c FROM recipients WHERE campaign_id = ?`).get(campaignId) as {
    c: number;
  };
  return row.c;
}

export function getRecipient(id: string): Recipient | null {
  const row = getDb().prepare(`SELECT * FROM recipients WHERE id = ?`).get(id) as unknown as RecipientRow | undefined;
  return row ? rowToRecipient(row) : null;
}

export function getPendingRecipients(campaignId: string): Recipient[] {
  const rows = getDb()
    .prepare(`SELECT * FROM recipients WHERE campaign_id = ? AND status = 'pending' ORDER BY row_index ASC`)
    .all(campaignId) as unknown as RecipientRow[];
  return rows.map(rowToRecipient);
}

export function getFailedRecipients(campaignId: string): Recipient[] {
  const rows = getDb()
    .prepare(`SELECT * FROM recipients WHERE campaign_id = ? AND status = 'failed' ORDER BY row_index ASC`)
    .all(campaignId) as unknown as RecipientRow[];
  return rows.map(rowToRecipient);
}

export interface RecipientUpdate {
  status?: RecipientStatus;
  errorReason?: string | null;
  failureCategory?: FailureCategory | null;
  attempts?: number;
  lastAttemptAt?: string | null;
  sentAt?: string | null;
  isExcludedRecent?: boolean;
}

export function updateRecipient(id: string, update: RecipientUpdate): void {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];
  if (update.status !== undefined) {
    sets.push("status = ?");
    values.push(update.status);
  }
  if (update.errorReason !== undefined) {
    sets.push("error_reason = ?");
    values.push(update.errorReason);
  }
  if (update.failureCategory !== undefined) {
    sets.push("failure_category = ?");
    values.push(update.failureCategory);
  }
  if (update.attempts !== undefined) {
    sets.push("attempts = ?");
    values.push(update.attempts);
  }
  if (update.lastAttemptAt !== undefined) {
    sets.push("last_attempt_at = ?");
    values.push(update.lastAttemptAt);
  }
  if (update.sentAt !== undefined) {
    sets.push("sent_at = ?");
    values.push(update.sentAt);
  }
  if (update.isExcludedRecent !== undefined) {
    sets.push("is_excluded_recent = ?");
    values.push(update.isExcludedRecent ? 1 : 0);
  }
  if (sets.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE recipients SET ${sets.join(", ")} WHERE id = ?`).run(...(values as (string | number | null)[]));
}

export function excludeRecipients(ids: string[]): void {
  const db = getDb();
  const stmt = db.prepare(`UPDATE recipients SET status = 'excluded' WHERE id = ?`);
  withTransaction(() => {
    for (const id of ids) stmt.run(id);
  });
}

export function recomputeCampaignStats(campaignId: string): {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
} {
  const db = getDb();
  const total = (db.prepare(`SELECT COUNT(*) c FROM recipients WHERE campaign_id = ?`).get(campaignId) as { c: number }).c;
  const sent = (
    db.prepare(`SELECT COUNT(*) c FROM recipients WHERE campaign_id = ? AND status = 'sent'`).get(campaignId) as {
      c: number;
    }
  ).c;
  const failed = (
    db.prepare(`SELECT COUNT(*) c FROM recipients WHERE campaign_id = ? AND status = 'failed'`).get(campaignId) as {
      c: number;
    }
  ).c;
  const skipped = (
    db
      .prepare(`SELECT COUNT(*) c FROM recipients WHERE campaign_id = ? AND status IN ('skipped','excluded')`)
      .get(campaignId) as { c: number }
  ).c;
  db.prepare(
    `UPDATE campaigns SET total_recipients = ?, sent_count = ?, failed_count = ?, skipped_count = ? WHERE id = ?`
  ).run(total, sent, failed, skipped, campaignId);
  return { total, sent, failed, skipped };
}
