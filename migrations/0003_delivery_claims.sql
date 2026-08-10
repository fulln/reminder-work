CREATE TABLE IF NOT EXISTS delivery_claims (
  idempotency_key TEXT PRIMARY KEY,
  reminder_id TEXT NOT NULL,
  status TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS delivery_claims_status_idx
  ON delivery_claims (status, updated_at);
