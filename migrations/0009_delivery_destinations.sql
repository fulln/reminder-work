CREATE TABLE IF NOT EXISTS delivery_destinations (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('slack', 'webhook')),
  label TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'failing', 'disabled')),
  credential_ciphertext TEXT NOT NULL,
  consecutive_failures INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  last_success_at TEXT,
  last_failure_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS delivery_destinations_owner_idx
  ON delivery_destinations (owner_user_id, updated_at);

CREATE TABLE IF NOT EXISTS delivery_attempts (
  idempotency_key TEXT PRIMARY KEY,
  reminder_id TEXT,
  destination_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'sent', 'failed', 'skipped')),
  failure_code TEXT,
  attempted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS delivery_attempts_destination_idx
  ON delivery_attempts (destination_id, updated_at);

CREATE TABLE IF NOT EXISTS slack_oauth_states (
  state_hash TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS slack_oauth_states_owner_idx
  ON slack_oauth_states (owner_user_id, consumed_at, expires_at);
