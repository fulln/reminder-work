import type { SlackOAuthStateRepository } from "../../../application/ports/slack-oauth";
import { stableDigest } from "../crypto/encrypted-json";

const stateLifetimeMs = 10 * 60 * 1000;

export class D1SlackOAuthStateRepository implements SlackOAuthStateRepository {
  constructor(private readonly database: D1Database) {}

  async issue(ownerUserId: string, now: Date): Promise<string> {
    const state = crypto.randomUUID() + crypto.randomUUID();
    await this.database
      .prepare(
        `DELETE FROM slack_oauth_states
         WHERE expires_at <= ? OR consumed_at IS NOT NULL`,
      )
      .bind(now.toISOString())
      .run();
    await this.database
      .prepare(
        `INSERT INTO slack_oauth_states
         (state_hash, owner_user_id, expires_at, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(
        await stableDigest(state),
        ownerUserId,
        new Date(now.getTime() + stateLifetimeMs).toISOString(),
        now.toISOString(),
      )
      .run();
    return state;
  }

  async consume(
    state: string,
    ownerUserId: string,
    now: Date,
  ): Promise<boolean> {
    const result = await this.database
      .prepare(
        `UPDATE slack_oauth_states SET consumed_at = ?
         WHERE state_hash = ? AND owner_user_id = ?
           AND consumed_at IS NULL AND expires_at > ?`,
      )
      .bind(
        now.toISOString(),
        await stableDigest(state),
        ownerUserId,
        now.toISOString(),
      )
      .run();
    return result.meta.changes === 1;
  }
}
