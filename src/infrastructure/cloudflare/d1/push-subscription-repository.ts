import type { PushSubscriptionInput } from "../../../application/contracts/push-subscription";
import type {
  PushSubscriptionRepository,
  StoredPushSubscription,
} from "../../../application/ports/push-subscription-repository";
import {
  decryptJson,
  encryptJson,
  stableDigest,
} from "../crypto/encrypted-json";

interface PushSubscriptionRow {
  readonly id: string;
  readonly subscription_ciphertext: string;
}

export class D1PushSubscriptionRepository implements PushSubscriptionRepository {
  constructor(
    private readonly database: D1Database,
    private readonly keyMaterial: string,
  ) {}

  async upsert(
    subscription: PushSubscriptionInput,
    now: string,
  ): Promise<string> {
    const endpointHash = await stableDigest(subscription.endpoint);
    const ciphertext = await encryptJson(subscription, this.keyMaterial);
    const existing = await this.database
      .prepare(
        "SELECT id, subscription_ciphertext FROM push_subscriptions WHERE endpoint_hash = ?",
      )
      .bind(endpointHash)
      .first<PushSubscriptionRow>();
    if (existing !== null) {
      await this.database
        .prepare(
          `UPDATE push_subscriptions
           SET subscription_ciphertext = ?, status = 'active', updated_at = ?
           WHERE id = ?`,
        )
        .bind(ciphertext, now, existing.id)
        .run();
      return existing.id;
    }

    const id = crypto.randomUUID();
    await this.database
      .prepare(
        `INSERT INTO push_subscriptions
         (id, endpoint_hash, subscription_ciphertext, status, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?)`,
      )
      .bind(id, endpointHash, ciphertext, now, now)
      .run();
    return id;
  }

  async findActiveById(id: string): Promise<StoredPushSubscription | null> {
    const row = await this.database
      .prepare(
        `SELECT id, subscription_ciphertext FROM push_subscriptions
         WHERE id = ? AND status = 'active'`,
      )
      .bind(id)
      .first<PushSubscriptionRow>();
    if (row === null) return null;
    return {
      id: row.id,
      ...(await decryptJson<PushSubscriptionInput>(
        row.subscription_ciphertext,
        this.keyMaterial,
      )),
    };
  }

  async revoke(id: string, now: string): Promise<void> {
    await this.database
      .prepare(
        `UPDATE push_subscriptions SET status = 'revoked', updated_at = ?
         WHERE id = ?`,
      )
      .bind(now, id)
      .run();
  }
}
