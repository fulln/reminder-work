ALTER TABLE reminders
  ADD COLUMN owner_user_id TEXT;

CREATE INDEX IF NOT EXISTS reminders_owner_status_idx
  ON reminders (owner_user_id, status, updated_at);

CREATE TABLE IF NOT EXISTS email_identities (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  recipient_ref TEXT NOT NULL,
  email_ciphertext TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_verification', 'verified')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  verified_at TEXT,
  UNIQUE (owner_user_id, recipient_ref)
);

CREATE INDEX IF NOT EXISTS email_identities_owner_status_idx
  ON email_identities (owner_user_id, status, updated_at);

CREATE TABLE IF NOT EXISTS email_identity_verification_tokens (
  token_hash TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS email_identity_verification_tokens_owner_idx
  ON email_identity_verification_tokens (owner_user_id, identity_id, consumed_at);
