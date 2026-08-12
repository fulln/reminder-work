import type {
  EmailIdentity,
  EmailIdentityRepository,
  EmailIdentityStatus,
} from "../../../application/ports/email-identity-repository";
import {
  decryptJson,
  encryptJson,
  keyedDigest,
  stableDigest,
} from "../crypto/encrypted-json";

interface EmailIdentityRow {
  readonly id: string;
  readonly owner_user_id: string;
  readonly recipient_ref: string;
  readonly email_ciphertext: string;
  readonly status: EmailIdentityStatus;
  readonly created_at: string;
  readonly updated_at: string;
  readonly verified_at: string | null;
  readonly delivery_suppressed?: number;
  readonly active_reminder_count?: number;
}

interface SavedEmailRecipientRow {
  readonly id: string;
  readonly owner_user_id: string;
  readonly recipient_ref: string;
  readonly email_ciphertext: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly delivery_suppressed?: number;
  readonly active_reminder_count?: number;
}

export class D1EmailIdentityRepository implements EmailIdentityRepository {
  constructor(
    private readonly database: D1Database,
    private readonly keyMaterial: string,
  ) {}

  async remember(
    ownerUserId: string,
    email: string,
    createdAt: string,
    id = crypto.randomUUID(),
  ): Promise<EmailIdentity> {
    const recipientRef = await keyedDigest(email, this.keyMaterial);
    const legacyRecipientRef = await stableDigest(email);
    const ciphertext = await encryptJson({ email }, this.keyMaterial);
    const legacy = await this.findSavedByOwnerAndRecipientRef(
      ownerUserId,
      legacyRecipientRef,
    );
    if (legacy !== null) {
      await this.database
        .prepare(
          `UPDATE saved_email_recipients
           SET recipient_ref = ?, email_ciphertext = ?, updated_at = ?
           WHERE owner_user_id = ? AND id = ?`,
        )
        .bind(recipientRef, ciphertext, createdAt, ownerUserId, legacy.id)
        .run();
      const migrated = await this.findSavedByOwnerAndRecipientRef(
        ownerUserId,
        recipientRef,
      );
      if (migrated === null) throw new Error("EMAIL_RECIPIENT_PERSIST_FAILED");
      return migrated;
    }

    await this.database
      .prepare(
        `INSERT INTO saved_email_recipients
         (id, owner_user_id, recipient_ref, email_ciphertext, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(owner_user_id, recipient_ref)
         DO UPDATE SET email_ciphertext = excluded.email_ciphertext, updated_at = excluded.updated_at`,
      )
      .bind(id, ownerUserId, recipientRef, ciphertext, createdAt, createdAt)
      .run();

    const saved = await this.findSavedByOwnerAndRecipientRef(
      ownerUserId,
      recipientRef,
    );
    if (saved === null) throw new Error("EMAIL_RECIPIENT_PERSIST_FAILED");
    return saved;
  }

  async forget(ownerUserId: string, identityId: string): Promise<boolean> {
    const result = await this.database
      .prepare(
        "DELETE FROM saved_email_recipients WHERE owner_user_id = ? AND id = ?",
      )
      .bind(ownerUserId, identityId)
      .run();
    return result.meta.changes === 1;
  }

  async createPending(
    ownerUserId: string,
    email: string,
    createdAt: string,
    id = crypto.randomUUID(),
  ): Promise<EmailIdentity> {
    const recipientRef = await stableDigest(email);
    const ciphertext = await encryptJson({ email }, this.keyMaterial);
    await this.database
      .prepare(
        `INSERT INTO email_identities
         (id, owner_user_id, recipient_ref, email_ciphertext, status, created_at, updated_at, verified_at)
         VALUES (?, ?, ?, ?, 'pending_verification', ?, ?, NULL)
         ON CONFLICT(owner_user_id, recipient_ref)
         DO UPDATE SET email_ciphertext = excluded.email_ciphertext, updated_at = excluded.updated_at`,
      )
      .bind(id, ownerUserId, recipientRef, ciphertext, createdAt, createdAt)
      .run();

    const existing = await this.findByOwnerAndRecipientRef(
      ownerUserId,
      recipientRef,
    );
    if (existing === null) {
      throw new Error("EMAIL_IDENTITY_PERSIST_FAILED");
    }
    return existing;
  }

  async findById(
    ownerUserId: string,
    identityId: string,
  ): Promise<EmailIdentity | null> {
    const row = await this.database
      .prepare(
        `${baseSelect}
         WHERE ei.owner_user_id = ? AND ei.id = ?`,
      )
      .bind(ownerUserId, identityId)
      .first<EmailIdentityRow>();
    return row === null ? null : this.toIdentity(row);
  }

  async findByOwner(ownerUserId: string): Promise<EmailIdentity[]> {
    const rows = await this.database
      .prepare(
        `${savedRecipientSelect}
         WHERE sr.owner_user_id = ?
         ORDER BY sr.updated_at DESC, sr.created_at DESC, sr.id DESC`,
      )
      .bind(ownerUserId)
      .all<SavedEmailRecipientRow>();
    return Promise.all(
      rows.results.map((row) => this.toSavedEmailRecipient(row)),
    );
  }

  async findByOwnerAndEmail(
    ownerUserId: string,
    email: string,
  ): Promise<EmailIdentity | null> {
    return this.findByOwnerAndRecipientRef(
      ownerUserId,
      await stableDigest(email),
    );
  }

  async findByOwnerAndRecipientRef(
    ownerUserId: string,
    recipientRef: string,
  ): Promise<EmailIdentity | null> {
    const row = await this.database
      .prepare(
        `${baseSelect}
         WHERE ei.owner_user_id = ? AND ei.recipient_ref = ?`,
      )
      .bind(ownerUserId, recipientRef)
      .first<EmailIdentityRow>();
    return row === null ? null : this.toIdentity(row);
  }

  async markVerified(
    ownerUserId: string,
    identityId: string,
    verifiedAt: string,
  ): Promise<boolean> {
    const update = await this.database
      .prepare(
        `UPDATE email_identities
         SET status = 'verified', verified_at = COALESCE(verified_at, ?), updated_at = ?
         WHERE owner_user_id = ? AND id = ?`,
      )
      .bind(verifiedAt, verifiedAt, ownerUserId, identityId)
      .run();
    return update.meta.changes === 1;
  }

  private async toIdentity(row: EmailIdentityRow): Promise<EmailIdentity> {
    const payload = await decryptJson<{ email: string }>(
      row.email_ciphertext,
      this.keyMaterial,
    );
    return {
      id: row.id,
      ownerUserId: row.owner_user_id,
      recipientRef: row.recipient_ref,
      email: payload.email,
      status: row.status,
      deliverySuppressed: row.delivery_suppressed === 1,
      activeReminderCount: row.active_reminder_count ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      verifiedAt: row.verified_at,
    };
  }

  private async findSavedByOwnerAndRecipientRef(
    ownerUserId: string,
    recipientRef: string,
  ): Promise<EmailIdentity | null> {
    const row = await this.database
      .prepare(
        `${savedRecipientSelect}
         WHERE sr.owner_user_id = ? AND sr.recipient_ref = ?`,
      )
      .bind(ownerUserId, recipientRef)
      .first<SavedEmailRecipientRow>();
    return row === null ? null : this.toSavedEmailRecipient(row);
  }

  private async toSavedEmailRecipient(
    row: SavedEmailRecipientRow,
  ): Promise<EmailIdentity> {
    const payload = await decryptJson<{ email: string }>(
      row.email_ciphertext,
      this.keyMaterial,
    );
    return {
      id: row.id,
      ownerUserId: row.owner_user_id,
      recipientRef: row.recipient_ref,
      email: payload.email,
      status: "verified",
      deliverySuppressed: row.delivery_suppressed === 1,
      activeReminderCount: row.active_reminder_count ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      verifiedAt: null,
    };
  }
}

const baseSelect = `
  SELECT
    ei.*,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM recipient_suppressions rs
        WHERE rs.recipient_ref = ei.recipient_ref
      ) THEN 1
      ELSE 0
    END AS delivery_suppressed,
    (
      SELECT COUNT(*)
      FROM reminders r
      WHERE r.owner_user_id = ei.owner_user_id
        AND r.recipient_ref = ei.recipient_ref
        AND r.status IN ('active', 'snoozed')
    ) AS active_reminder_count
  FROM email_identities ei
`;

const savedRecipientSelect = `
  SELECT
    sr.*,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM recipient_suppressions rs
        WHERE rs.recipient_ref = sr.recipient_ref
      ) THEN 1
      ELSE 0
    END AS delivery_suppressed,
    (
      SELECT COUNT(*)
      FROM reminders r
      WHERE r.owner_user_id = sr.owner_user_id
        AND r.recipient_ref = sr.recipient_ref
        AND r.status IN ('active', 'snoozed')
    ) AS active_reminder_count
  FROM saved_email_recipients sr
`;
