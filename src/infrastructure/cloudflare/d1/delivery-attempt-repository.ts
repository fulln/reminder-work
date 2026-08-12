import type { DeliveryAttemptRepository } from "../../../application/ports/delivery-attempt-repository";

export class D1DeliveryAttemptRepository implements DeliveryAttemptRepository {
  constructor(private readonly database: D1Database) {}

  async countRecentTests(
    destinationId: string,
    since: string,
  ): Promise<number> {
    const row = await this.database
      .prepare(
        `SELECT COUNT(*) AS total FROM delivery_attempts
         WHERE destination_id = ? AND event_type = 'delivery.test'
           AND attempted_at >= ?`,
      )
      .bind(destinationId, since)
      .first<{ readonly total: number }>();
    return row?.total ?? 0;
  }

  async record(
    input: Parameters<DeliveryAttemptRepository["record"]>[0],
  ): Promise<void> {
    await this.database
      .prepare(
        `INSERT INTO delivery_attempts
         (idempotency_key, reminder_id, destination_id, event_type, status, failure_code, attempted_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(idempotency_key) DO UPDATE SET
           status = excluded.status,
           failure_code = excluded.failure_code,
           updated_at = excluded.updated_at`,
      )
      .bind(
        input.idempotencyKey,
        input.reminderId ?? null,
        input.destinationId,
        input.eventType,
        input.status,
        input.failureCode ?? null,
        input.occurredAt,
        input.occurredAt,
      )
      .run();
  }
}
