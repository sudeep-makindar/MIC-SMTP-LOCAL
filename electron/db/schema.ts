// Kept as a TS string (rather than reading schema.sql at runtime) so the
// compiled dist-electron output is self-contained and doesn't need an asset
// copy step.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  template_id TEXT,
  subject TEXT DEFAULT '',
  recipient_file_name TEXT,
  column_mapping TEXT DEFAULT '{}',
  placeholder_mapping TEXT DEFAULT '{}',
  attachment_config TEXT DEFAULT '{"mode":"none"}',
  sending_mode TEXT DEFAULT 'automatic_interval',
  interval_config TEXT DEFAULT '{"minSeconds":3,"maxSeconds":8}',
  batch_config TEXT DEFAULT '{"batchSize":50,"pauseSeconds":60}',
  smtp_profile_id TEXT,
  test_email_sent_at TEXT,
  cc_emails TEXT DEFAULT '',
  bcc_emails TEXT DEFAULT '',
  reply_to TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS recipients (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  attachment_path TEXT,
  error_reason TEXT,
  failure_category TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  sent_at TEXT,
  is_duplicate INTEGER NOT NULL DEFAULT 0,
  is_excluded_recent INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_recipients_campaign ON recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_recipients_email ON recipients(email);
CREATE INDEX IF NOT EXISTS idx_recipients_status ON recipients(campaign_id, status);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  body_path TEXT NOT NULL,
  assets_path TEXT,
  placeholders TEXT DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS smtp_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  security TEXT NOT NULL DEFAULT 'ssl',
  username TEXT NOT NULL,
  from_name TEXT DEFAULT '',
  from_email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS send_log (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  campaign_id TEXT,
  campaign_name TEXT,
  sender TEXT,
  recipient TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL,
  failure_reason TEXT,
  failure_category TEXT,
  attempt_number INTEGER DEFAULT 1,
  template TEXT,
  attachment_info TEXT,
  sending_mode TEXT
);

CREATE INDEX IF NOT EXISTS idx_sendlog_recipient ON send_log(recipient);
CREATE INDEX IF NOT EXISTS idx_sendlog_campaign ON send_log(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sendlog_timestamp ON send_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_sendlog_status ON send_log(status);
CREATE INDEX IF NOT EXISTS idx_sendlog_subject ON send_log(subject);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;
