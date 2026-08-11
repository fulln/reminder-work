ALTER TABLE reminders
  ADD COLUMN delivery_plan_json TEXT NOT NULL
  DEFAULT '{"mode":"email","targets":[{"channel":"email"}]}';

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  endpoint_hash TEXT NOT NULL UNIQUE,
  subscription_ciphertext TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS push_subscriptions_status_idx
  ON push_subscriptions (status, updated_at);
