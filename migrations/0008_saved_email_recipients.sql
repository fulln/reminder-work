CREATE TABLE IF NOT EXISTS saved_email_recipients (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  recipient_ref TEXT NOT NULL,
  email_ciphertext TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (owner_user_id, recipient_ref)
);

CREATE INDEX IF NOT EXISTS saved_email_recipients_owner_idx
  ON saved_email_recipients (owner_user_id, updated_at);

INSERT OR IGNORE INTO saved_email_recipients
  (id, owner_user_id, recipient_ref, email_ciphertext, created_at, updated_at)
SELECT id, owner_user_id, recipient_ref, email_ciphertext, created_at, updated_at
FROM email_identities
WHERE status = 'verified';
