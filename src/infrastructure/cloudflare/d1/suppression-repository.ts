import type { SuppressionRepository } from "../../../application/ports/suppression-repository";

export class D1SuppressionRepository implements SuppressionRepository {
  constructor(private readonly database: D1Database) {}

  async suppress(recipientRef: string, createdAt: string): Promise<void> {
    await this.database
      .prepare(
        "INSERT OR IGNORE INTO recipient_suppressions (recipient_ref, created_at) VALUES (?, ?)",
      )
      .bind(recipientRef, createdAt)
      .run();
  }

  async isSuppressed(recipientRef: string): Promise<boolean> {
    const row = await this.database
      .prepare(
        "SELECT 1 AS suppressed FROM recipient_suppressions WHERE recipient_ref = ?",
      )
      .bind(recipientRef)
      .first<{ suppressed: number }>();
    return row !== null;
  }
}
