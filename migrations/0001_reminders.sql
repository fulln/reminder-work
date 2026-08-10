CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL,
  schedule_json TEXT NOT NULL,
  recipient_ref TEXT NOT NULL,
  content_ciphertext TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS reminder_tokens (
  token_hash TEXT PRIMARY KEY,
  reminder_id TEXT NOT NULL,
  purpose TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);

CREATE INDEX IF NOT EXISTS reminder_tokens_reminder_idx
  ON reminder_tokens (reminder_id, purpose);

CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY,
  reminder_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  processed_at TEXT
);

CREATE INDEX IF NOT EXISTS outbox_pending_idx
  ON outbox (processed_at, created_at);
