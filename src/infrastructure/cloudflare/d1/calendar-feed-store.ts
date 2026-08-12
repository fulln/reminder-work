import type { CalendarFeedStore } from "../../../application/ports/calendar-feed-store";
import type { Reminder } from "../../../domain/reminder/reminder";
import { hashOpaqueToken, randomOpaqueToken } from "../tokens/opaque-token";
import { reminderFromRow, type ReminderRow } from "./reminder-repository";

export class D1CalendarFeedStore implements CalendarFeedStore {
  constructor(private readonly database: D1Database) {}

  async issue(recipientRef: string, createdAt: string): Promise<string> {
    const token = randomOpaqueToken();
    await this.database
      .prepare(
        `INSERT INTO calendar_feed_tokens
         (token_hash, recipient_ref, created_at)
         VALUES (?, ?, ?)`,
      )
      .bind(await hashOpaqueToken(token), recipientRef, createdAt)
      .run();
    return token;
  }

  async findReminders(token: string): Promise<readonly Reminder[] | null> {
    const tokenRow = await this.database
      .prepare(
        `SELECT recipient_ref
         FROM calendar_feed_tokens
         WHERE token_hash = ? AND revoked_at IS NULL`,
      )
      .bind(await hashOpaqueToken(token))
      .first<{ readonly recipient_ref: string }>();
    if (tokenRow === null) return null;

    const result = await this.database
      .prepare(
        `SELECT * FROM reminders
         WHERE recipient_ref = ?
           AND status IN ('active', 'snoozed')
         ORDER BY created_at ASC, id ASC`,
      )
      .bind(tokenRow.recipient_ref)
      .all<ReminderRow>();
    return result.results.map(reminderFromRow);
  }
}
