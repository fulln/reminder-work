export interface DeliveryClaimRepository {
  claim(
    idempotencyKey: string,
    reminderId: string,
    now: string,
  ): Promise<boolean>;
  markSent(idempotencyKey: string, now: string): Promise<void>;
  markFailed(idempotencyKey: string, now: string): Promise<void>;
}

export class D1DeliveryClaimRepository implements DeliveryClaimRepository {
  constructor(private readonly database: D1Database) {}

  async claim(
    idempotencyKey: string,
    reminderId: string,
    now: string,
  ): Promise<boolean> {
    const result = await this.database
      .prepare(
        `INSERT INTO delivery_claims (idempotency_key, reminder_id, status, updated_at)
         VALUES (?, ?, 'processing', ?)
         ON CONFLICT(idempotency_key) DO UPDATE SET
           status = 'processing', attempt_count = attempt_count + 1, updated_at = excluded.updated_at
         WHERE delivery_claims.status = 'failed'`,
      )
      .bind(idempotencyKey, reminderId, now)
      .run();
    return result.meta.changes === 1;
  }

  async markSent(idempotencyKey: string, now: string): Promise<void> {
    await this.setStatus(idempotencyKey, "sent", now);
  }

  async markFailed(idempotencyKey: string, now: string): Promise<void> {
    await this.setStatus(idempotencyKey, "failed", now);
  }

  private async setStatus(
    idempotencyKey: string,
    status: "sent" | "failed",
    now: string,
  ): Promise<void> {
    await this.database
      .prepare(
        "UPDATE delivery_claims SET status = ?, updated_at = ? WHERE idempotency_key = ?",
      )
      .bind(status, now, idempotencyKey)
      .run();
  }
}
