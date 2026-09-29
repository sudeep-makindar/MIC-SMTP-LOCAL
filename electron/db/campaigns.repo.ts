import { v4 as uuid } from "uuid";
import { getDb } from "./index";
import type { Campaign, CampaignStatus } from "../../shared/types";

interface CampaignRow {
  id: string;
  name: string;
  description: string;
  status: string;
  template_id: string | null;
  subject: string;
  recipient_file_name: string | null;
  column_mapping: string;
  placeholder_mapping: string;
  attachment_config: string;
  sending_mode: string;
  interval_config: string;
  batch_config: string;
  smtp_profile_id: string | null;
  test_email_sent_at: string | null;
  cc_emails: string | null;
  bcc_emails: string | null;
  reply_to: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
}

function rowToCampaign(r: CampaignRow): Campaign {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    status: r.status as CampaignStatus,
    templateId: r.template_id,
    subject: r.subject ?? "",
    recipientFileName: r.recipient_file_name,
    columnMapping: JSON.parse(r.column_mapping || "{}"),
    placeholderMapping: JSON.parse(r.placeholder_mapping || "{}"),
    attachmentConfig: JSON.parse(r.attachment_config || '{"mode":"none"}'),
    sendingMode: r.sending_mode as Campaign["sendingMode"],
    intervalConfig: JSON.parse(r.interval_config || '{"minSeconds":3,"maxSeconds":8}'),
    batchConfig: JSON.parse(r.batch_config || '{"batchSize":50,"pauseSeconds":60}'),
    smtpProfileId: r.smtp_profile_id,
    testEmailSentAt: r.test_email_sent_at,
    ccEmails: r.cc_emails ?? "",
    bccEmails: r.bcc_emails ?? "",
    replyTo: r.reply_to ?? "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    totalRecipients: r.total_recipients ?? 0,
    sentCount: r.sent_count ?? 0,
    failedCount: r.failed_count ?? 0,
    skippedCount: r.skipped_count ?? 0,
  };
}

export function createCampaign(name: string, description: string): Campaign {
  const db = getDb();
  const now = new Date().toISOString();
  const id = uuid();
  db.prepare(
    `INSERT INTO campaigns (id, name, description, status, created_at, updated_at)
     VALUES (?, ?, ?, 'draft', ?, ?)`
  ).run(id, name, description, now, now);
  return getCampaign(id)!;
}

export function getCampaign(id: string): Campaign | null {
  const row = getDb().prepare(`SELECT * FROM campaigns WHERE id = ?`).get(id) as unknown as CampaignRow | undefined;
  return row ? rowToCampaign(row) : null;
}

export function listCampaigns(): Campaign[] {
  const rows = getDb().prepare(`SELECT * FROM campaigns ORDER BY updated_at DESC`).all() as unknown as CampaignRow[];
  return rows.map(rowToCampaign);
}

export function cloneCampaign(id: string): Campaign {
  const original = getCampaign(id);
  if (!original) throw new Error("Campaign not found");
  const newId = uuid();
  const now = new Date().toISOString();
  const name = `${original.name} (Clone)`;
  
  const db = getDb();
  db.prepare(
    `INSERT INTO campaigns (
      id, name, description, status, template_id, subject, recipient_file_name, 
      column_mapping, placeholder_mapping, attachment_config, sending_mode, 
      interval_config, batch_config, smtp_profile_id, cc_emails, bcc_emails, 
      reply_to, created_at, updated_at
    )
    SELECT 
      ?, ?, description, 'draft', template_id, subject, recipient_file_name, 
      column_mapping, placeholder_mapping, attachment_config, sending_mode, 
      interval_config, batch_config, smtp_profile_id, cc_emails, bcc_emails, 
      reply_to, ?, ?
    FROM campaigns WHERE id = ?`
  ).run(newId, name, now, now, id);
  
  return getCampaign(newId)!;
}

export interface CampaignUpdate {
  name?: string;
  description?: string;
  status?: CampaignStatus;
  templateId?: string | null;
  subject?: string;
  recipientFileName?: string | null;
  columnMapping?: Campaign["columnMapping"];
  placeholderMapping?: Campaign["placeholderMapping"];
  attachmentConfig?: Campaign["attachmentConfig"];
  sendingMode?: Campaign["sendingMode"];
  intervalConfig?: Campaign["intervalConfig"];
  batchConfig?: Campaign["batchConfig"];
  smtpProfileId?: string | null;
  testEmailSentAt?: string | null;
  ccEmails?: string;
  bccEmails?: string;
  replyTo?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  totalRecipients?: number;
  sentCount?: number;
  failedCount?: number;
  skippedCount?: number;
}

const COLUMN_MAP: Record<keyof CampaignUpdate, string> = {
  name: "name",
  description: "description",
  status: "status",
  templateId: "template_id",
  subject: "subject",
  recipientFileName: "recipient_file_name",
  columnMapping: "column_mapping",
  placeholderMapping: "placeholder_mapping",
  attachmentConfig: "attachment_config",
  sendingMode: "sending_mode",
  intervalConfig: "interval_config",
  batchConfig: "batch_config",
  smtpProfileId: "smtp_profile_id",
  testEmailSentAt: "test_email_sent_at",
  ccEmails: "cc_emails",
  bccEmails: "bcc_emails",
  replyTo: "reply_to",
  startedAt: "started_at",
  completedAt: "completed_at",
  totalRecipients: "total_recipients",
  sentCount: "sent_count",
  failedCount: "failed_count",
  skippedCount: "skipped_count",
};

const JSON_FIELDS = new Set(["columnMapping", "placeholderMapping", "attachmentConfig", "intervalConfig", "batchConfig"]);

export function updateCampaign(id: string, update: CampaignUpdate): Campaign {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const key of Object.keys(update) as (keyof CampaignUpdate)[]) {
    const col = COLUMN_MAP[key];
    if (!col) continue;
    let value = update[key] as unknown;
    if (JSON_FIELDS.has(key)) value = JSON.stringify(value);
    sets.push(`${col} = ?`);
    values.push(value);
  }
  sets.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(id);
  db.prepare(`UPDATE campaigns SET ${sets.join(", ")} WHERE id = ?`).run(...(values as (string | number | null)[]));
  return getCampaign(id)!;
}

export function deleteCampaign(id: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM recipients WHERE campaign_id = ?`).run(id);
  db.prepare(`DELETE FROM campaigns WHERE id = ?`).run(id);
}

export function listInterruptibleCampaigns(): Campaign[] {
  const rows = getDb()
    .prepare(`SELECT * FROM campaigns WHERE status IN ('sending', 'paused') ORDER BY updated_at DESC`)
    .all() as unknown as CampaignRow[];
  return rows.map(rowToCampaign);
}

export function markInterrupted(id: string): void {
  updateCampaign(id, { status: "interrupted" });
}
