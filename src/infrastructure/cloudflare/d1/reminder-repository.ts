import type { OwnedReminderStore } from "../../../application/ports/owned-reminder-store";
import type { PendingReminderStore } from "../../../application/ports/pending-reminder-store";
import type { ReminderRepository } from "../../../application/ports/reminder-repository";
import type { Reminder } from "../../../domain/reminder/reminder";

export interface ReminderRow {
  readonly id: string;
  readonly owner_user_id: string | null;
  readonly version: number;
  readonly status: Reminder["status"];
  readonly schedule_json: string;
  readonly delivery_plan_json: string;
  readonly recipient_ref: string;
  readonly content_ciphertext: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export function reminderFromRow(row: ReminderRow): Reminder {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    version: row.version,
    status: row.status,
    schedule: JSON.parse(row.schedule_json) as Reminder["schedule"],
    deliveryPlan: JSON.parse(
      row.delivery_plan_json,
    ) as Reminder["deliveryPlan"],
    recipientRef: row.recipient_ref,
    contentCiphertext: row.content_ciphertext,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class D1ReminderRepository
  implements ReminderRepository, PendingReminderStore, OwnedReminderStore
{
  constructor(private readonly database: D1Database) {}

  async createPending(
    reminder: Reminder,
    idempotencyKey: string,
  ): Promise<void> {
    await this.insert(reminder, idempotencyKey, "verification_requested");
  }

  async discardPending(reminderId: string): Promise<void> {
    await this.database.batch([
      this.database
        .prepare(
          `DELETE FROM outbox
           WHERE reminder_id = ?
             AND EXISTS (
               SELECT 1 FROM reminders
               WHERE id = ? AND status = 'pending_verification'
             )`,
        )
        .bind(reminderId, reminderId),
      this.database
        .prepare(
          "DELETE FROM reminders WHERE id = ? AND status = 'pending_verification'",
        )
        .bind(reminderId),
    ]);
  }

  async create(reminder: Reminder, idempotencyKey: string): Promise<void> {
    await this.insert(reminder, idempotencyKey, `reminder_${reminder.status}`);
  }

  private async insert(
    reminder: Reminder,
    idempotencyKey: string,
    operation: string,
  ): Promise<void> {
    await this.database.batch([
      this.database
        .prepare(
          `INSERT OR IGNORE INTO reminders
           (id, owner_user_id, version, status, schedule_json, delivery_plan_json, recipient_ref, content_ciphertext, created_at, updated_at, idempotency_key)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          reminder.id,
          reminder.ownerUserId ?? null,
          reminder.version,
          reminder.status,
          JSON.stringify(reminder.schedule),
          JSON.stringify(reminder.deliveryPlan),
          reminder.recipientRef,
          reminder.contentCiphertext,
          reminder.createdAt,
          reminder.updatedAt,
          idempotencyKey,
        ),
      this.database
        .prepare(
          "INSERT OR IGNORE INTO outbox (id, reminder_id, operation, schema_version, created_at) VALUES (?, ?, ?, 1, ?)",
        )
        .bind(crypto.randomUUID(), reminder.id, operation, reminder.createdAt),
    ]);
  }

  async findById(id: string): Promise<Reminder | null> {
    const row = await this.database
      .prepare("SELECT * FROM reminders WHERE id = ?")
      .bind(id)
      .first<ReminderRow>();
    return row === null ? null : reminderFromRow(row);
  }

  async findByOwner(ownerUserId: string): Promise<Reminder[]> {
    const rows = await this.database
      .prepare(
        `SELECT * FROM reminders
         WHERE owner_user_id = ?
         ORDER BY updated_at DESC, created_at DESC, id DESC`,
      )
      .bind(ownerUserId)
      .all<ReminderRow>();
    return rows.results.map(reminderFromRow);
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
          `UPDATE reminders SET owner_user_id = ?, version = ?, status = ?, schedule_json = ?, delivery_plan_json = ?, updated_at = ?
           WHERE id = ? AND version = ?`,
        )
        .bind(
          reminder.ownerUserId ?? null,
          reminder.version,
          reminder.status,
          JSON.stringify(reminder.schedule),
          JSON.stringify(reminder.deliveryPlan),
          reminder.updatedAt,
          reminder.id,
          expectedVersion,
        ),
    ]);
    return updated?.meta.changes === 1;
  }
}
