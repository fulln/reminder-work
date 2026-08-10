CREATE TABLE IF NOT EXISTS recipient_suppressions (
  recipient_ref TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS reminders_recipient_idx
  ON reminders (recipient_ref, status);
