CREATE INDEX IF NOT EXISTS delivery_attempts_test_limit_idx
  ON delivery_attempts (destination_id, event_type, attempted_at);
