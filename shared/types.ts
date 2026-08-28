// Shared domain types used by both the Electron main process and the React renderer.

export type CampaignStatus =
  | "draft"
  | "ready"
  | "sending"
  | "paused"
  | "completed"
  | "failed"
  | "interrupted"
  | "cancelled";

export type RecipientStatus =
  | "pending"
  | "sending"
  | "sent"
  | "failed"
  | "skipped"
  | "excluded";

export type SendingMode = "manual" | "automatic" | "automatic_interval" | "batch";

export type SmtpSecurity = "ssl" | "tls" | "none";

export type FailureCategory =
  | "invalid_recipient"
  | "auth_failure"
  | "connection_failure"
  | "timeout"
  | "smtp_rejection"
  | "attachment_failure"
  | "network_error"
  | "other";

export type TemplateType = "html" | "text";

export interface Template {
  id: string;
  name: string;
  type: TemplateType;
  bodyPath: string; // relative path inside data/templates/<id>/
  assetsPath: string | null; // relative path to assets folder, if any
  placeholders: string[]; // detected {{placeholder}} names, cached
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentConfig {
  mode: "none" | "static" | "per_recipient";
  staticFileName?: string | null; // file stored under campaign folder /attachments/
  columnName?: string | null; // spreadsheet column containing per-recipient path
}

export interface IntervalConfig {
  minSeconds: number;
  maxSeconds: number;
}

export interface BatchConfig {
  batchSize: number;
  pauseSeconds: number;
}

export interface SmtpProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  fromName: string;
  fromEmail: string;
  // Password is never persisted to disk. It lives only in the in-memory
  // credential store for the active session (see electron/lib/credential-store.ts).
}

export interface ColumnMapping {
  emailColumn: string | null;
}

export type PlaceholderMapping = Record<string, string>; // placeholder -> column name

export interface Campaign {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  templateId: string | null;
  subject: string;
  recipientFileName: string | null; // original filename, copied into campaign folder
  columnMapping: ColumnMapping;
  placeholderMapping: PlaceholderMapping;
  attachmentConfig: AttachmentConfig;
  sendingMode: SendingMode;
  intervalConfig: IntervalConfig;
  batchConfig: BatchConfig;
  smtpProfileId: string | null;
  testEmailSentAt: string | null;
  ccEmails: string; // comma/semicolon-separated, campaign-wide (applied to every send)
  bccEmails: string;
  replyTo: string; // single email address, optional
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
}

export interface Recipient {
  id: string;
  campaignId: string;
  rowIndex: number;
  data: Record<string, string>; // raw imported row
  email: string;
  status: RecipientStatus;
  attachmentPath: string | null;
  errorReason: string | null;
  failureCategory: FailureCategory | null;
  attempts: number;
  lastAttemptAt: string | null;
  sentAt: string | null;
  isDuplicate: boolean;
  isExcludedRecent: boolean;
}

export interface SendLogEntry {
  id: string;
  timestamp: string;
  campaignId: string;
  campaignName: string;
  sender: string;
  recipient: string;
  subject: string;
  status: RecipientStatus;
  failureReason: string | null;
  failureCategory: FailureCategory | null;
  attemptNumber: number;
  template: string | null;
  attachmentInfo: string | null;
  sendingMode: SendingMode;
}

export interface ImportSummary {
  totalRows: number;
  totalColumns: number;
  columns: string[];
  preview: Record<string, string>[]; // first N rows
  detectedEmailColumn: string | null;
  duplicateEmailCount: number;
  invalidEmailCount: number;
  missingRequiredCount: number;
}

export interface PreflightCheckItem {
  id: string;
  label: string;
  severity: "passed" | "warning" | "critical";
  detail: string;
  count?: number;
}

export interface PreflightReport {
  items: PreflightCheckItem[];
  hasCriticalErrors: boolean;
  summary: {
    imported: number;
    unique: number;
    valid: number;
    invalid: number;
    duplicates: number;
    attachmentsValid: number;
    attachmentsMissing: number;
    missingValues: number;
    recentlyContacted: number;
    smtpVerified: boolean;
    testEmailSent: boolean;
  };
}

export interface SendProgress {
  campaignId: string;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  remaining: number;
  currentRecipientId: string | null;
  currentRecipientEmail: string | null;
  status: CampaignStatus;
  lastResult: {
    recipientId: string;
    email: string;
    status: RecipientStatus;
    reason: string | null;
  } | null;
}

export interface RenderedEmail {
  subject: string;
  html: string | null;
  text: string | null;
  from: string;
  to: string;
  cc: string[];
  bcc: string[];
  replyTo: string | null;
  attachments: { name: string; path: string; exists: boolean }[];
  missingPlaceholders: string[];
}

export type PreviewDevice = "desktop" | "android" | "ios";
export type PreviewTheme = "light" | "dark";

export interface AppSettings {
  activeSmtpProfileId: string | null;
}

export interface BackupManifest {
  createdAt: string;
  appVersion: string;
  campaignIds: string[];
  templateIds: string[];
}
