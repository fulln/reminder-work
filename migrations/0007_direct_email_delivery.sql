CREATE TABLE IF NOT EXISTS email_reminder_creation_events (
  id TEXT PRIMARY KEY,
  actor_ref TEXT NOT NULL,
  recipient_ref TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS email_reminder_creation_events_actor_idx
  ON email_reminder_creation_events (actor_ref, created_at);

CREATE INDEX IF NOT EXISTS email_reminder_creation_events_recipient_idx
  ON email_reminder_creation_events (recipient_ref, created_at);
