import type { TokenClaims, TokenPort } from "../../../application/ports/token";
import { hashOpaqueToken, randomOpaqueToken } from "./opaque-token";

interface TokenRow {
  readonly reminder_id: string;
  readonly purpose: TokenClaims["purpose"];
  readonly expires_at: string;
  readonly consumed_at: string | null;
}

export class D1TokenPort implements TokenPort {
  constructor(private readonly database: D1Database) {}

  async issue(claims: TokenClaims): Promise<string> {
    const token = randomOpaqueToken();
    const hash = await hashOpaqueToken(token);
    await this.database
      .prepare(
        "INSERT INTO reminder_tokens (token_hash, reminder_id, purpose, expires_at) VALUES (?, ?, ?, ?)",
      )
      .bind(hash, claims.reminderId, claims.purpose, claims.expiresAt)
      .run();
    return token;
  }

  async revoke(token: string, purpose: TokenClaims["purpose"]): Promise<void> {
    const hash = await hashOpaqueToken(token);
    await this.database
      .prepare(
        "DELETE FROM reminder_tokens WHERE token_hash = ? AND purpose = ?",
      )
      .bind(hash, purpose)
      .run();
  }

  async consume(
    token: string,
    purpose: TokenClaims["purpose"],
  ): Promise<TokenClaims | null> {
    const claims = await this.resolve(token, purpose);
    if (claims === null) return null;
    const hash = await hashOpaqueToken(token);
    const update = await this.database
      .prepare(
        "UPDATE reminder_tokens SET consumed_at = ? WHERE token_hash = ? AND consumed_at IS NULL",
      )
      .bind(new Date().toISOString(), hash)
      .run();
    if (update.meta.changes !== 1) return null;
    return claims;
  }

  async resolve(
    token: string,
    purpose: TokenClaims["purpose"],
  ): Promise<TokenClaims | null> {
    const hash = await hashOpaqueToken(token);
    const row = await this.database
      .prepare(
        "SELECT reminder_id, purpose, expires_at, consumed_at FROM reminder_tokens WHERE token_hash = ? AND purpose = ?",
      )
      .bind(hash, purpose)
      .first<TokenRow>();
    if (row === null) return null;
    if (row.consumed_at !== null) return null;
    return {
      reminderId: row.reminder_id,
      purpose: row.purpose,
      expiresAt: row.expires_at,
    };
  }
}
