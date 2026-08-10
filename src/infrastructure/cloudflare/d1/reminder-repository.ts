import type { PendingReminderStore } from "../../../application/ports/pending-reminder-store";
import type { ReminderRepository } from "../../../application/ports/reminder-repository";
import type { Reminder } from "../../../domain/reminder/reminder";

interface ReminderRow {
  readonly id: string;
  readonly version: number;
  readonly status: Reminder["status"];
  readonly schedule_json: string;
  readonly recipient_ref: string;
  readonly content_ciphertext: string;
  readonly created_at: string;
  readonly updated_at: string;
}

function fromRow(row: ReminderRow): Reminder {
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    schedule: JSON.parse(row.schedule_json) as Reminder["schedule"],
    recipientRef: row.recipient_ref,
    contentCiphertext: row.content_ciphertext,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class D1ReminderRepository
  implements ReminderRepository, PendingReminderStore
{
  constructor(private readonly database: D1Database) {}

  async createPending(
    reminder: Reminder,
    idempotencyKey: string,
  ): Promise<void> {
    await this.database.batch([
      this.database
        .prepare(
          `INSERT OR IGNORE INTO reminders
           (id, version, status, schedule_json, recipient_ref, content_ciphertext, created_at, updated_at, idempotency_key)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          reminder.id,
          reminder.version,
          reminder.status,
          JSON.stringify(reminder.schedule),
          reminder.recipientRef,
          reminder.contentCiphertext,
          reminder.createdAt,
          reminder.updatedAt,
          idempotencyKey,
        ),
      this.database
        .prepare(
          "INSERT OR IGNORE INTO outbox (id, reminder_id, operation, schema_version, created_at) VALUES (?, ?, 'verification_requested', 1, ?)",
        )
        .bind(crypto.randomUUID(), reminder.id, reminder.createdAt),
    ]);
  }

  async create(reminder: Reminder, idempotencyKey: string): Promise<void> {
    await this.createPending(reminder, idempotencyKey);
  }

  async findById(id: string): Promise<Reminder | null> {
    const row = await this.database
      .prepare("SELECT * FROM reminders WHERE id = ?")
      .bind(id)
      .first<ReminderRow>();
    return row === null ? null : fromRow(row);
  }

  async save(reminder: Reminder, expectedVersion: number): Promise<boolean> {
    const [, updated] = await this.database.batch([
      this.database
        .prepare(
          `INSERT INTO outbox (id, reminder_id, operation, schema_version, created_at)
           SELECT ?, ?, ?, 1, ?
           WHERE EXISTS (SELECT 1 FROM reminders WHERE id = ? AND version = ?)`,
        )
        .bind(
          crypto.randomUUID(),
          reminder.id,
          `reminder_${reminder.status}`,
          reminder.updatedAt,
          reminder.id,
          expectedVersion,
        ),
      this.database
        .prepare(
          `UPDATE reminders SET version = ?, status = ?, schedule_json = ?, updated_at = ?
           WHERE id = ? AND version = ?`,
        )
        .bind(
          reminder.version,
          reminder.status,
          JSON.stringify(reminder.schedule),
          reminder.updatedAt,
          reminder.id,
          expectedVersion,
        ),
    ]);
    return updated?.meta.changes === 1;
  }
}
