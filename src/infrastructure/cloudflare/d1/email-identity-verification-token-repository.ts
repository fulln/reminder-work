import type {
  EmailIdentityVerificationClaims,
  EmailIdentityVerificationTokenRepository,
} from "../../../application/ports/email-identity-verification-token-repository";
import { hashOpaqueToken, randomOpaqueToken } from "../tokens/opaque-token";

interface EmailIdentityTokenRow {
  readonly identity_id: string;
  readonly owner_user_id: string;
  readonly expires_at: string;
  readonly consumed_at: string | null;
}

export class D1EmailIdentityVerificationTokenRepository implements EmailIdentityVerificationTokenRepository {
  constructor(private readonly database: D1Database) {}

  async issue(claims: EmailIdentityVerificationClaims): Promise<string> {
    const token = randomOpaqueToken();
    const hash = await hashOpaqueToken(token);
    await this.database
      .prepare(
        `INSERT INTO email_identity_verification_tokens
         (token_hash, identity_id, owner_user_id, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(
        hash,
        claims.identityId,
        claims.ownerUserId,
        claims.expiresAt,
        new Date().toISOString(),
      )
      .run();
    return token;
  }

  async revoke(token: string): Promise<void> {
    const hash = await hashOpaqueToken(token);
    await this.database
      .prepare(
        "DELETE FROM email_identity_verification_tokens WHERE token_hash = ?",
      )
      .bind(hash)
      .run();
  }

  async consume(
    token: string,
  ): Promise<EmailIdentityVerificationClaims | null> {
    const claims = await this.resolve(token);
    if (claims === null) return null;
    const hash = await hashOpaqueToken(token);
    const update = await this.database
      .prepare(
        `UPDATE email_identity_verification_tokens
         SET consumed_at = ?
         WHERE token_hash = ? AND consumed_at IS NULL`,
      )
      .bind(new Date().toISOString(), hash)
      .run();
    return update.meta.changes === 1 ? claims : null;
  }

  async resolve(
    token: string,
  ): Promise<EmailIdentityVerificationClaims | null> {
    const hash = await hashOpaqueToken(token);
    const row = await this.database
      .prepare(
        `SELECT identity_id, owner_user_id, expires_at, consumed_at
         FROM email_identity_verification_tokens
         WHERE token_hash = ?`,
      )
      .bind(hash)
      .first<EmailIdentityTokenRow>();
    if (row?.consumed_at !== null) return null;
    return {
      identityId: row.identity_id,
      ownerUserId: row.owner_user_id,
      expiresAt: row.expires_at,
    };
  }
}
