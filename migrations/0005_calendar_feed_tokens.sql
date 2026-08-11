CREATE TABLE IF NOT EXISTS calendar_feed_tokens (
  token_hash TEXT PRIMARY KEY,
  recipient_ref TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS calendar_feed_tokens_recipient_idx
  ON calendar_feed_tokens (recipient_ref, revoked_at);
