import type {
  DeliveryDestination,
  DeliveryDestinationCredential,
  DeliveryDestinationRepository,
  DeliveryDestinationStatus,
  DeliveryDestinationType,
  NewDeliveryDestination,
} from "../../../application/ports/delivery-destination-repository";
import { decryptJson, encryptJson } from "../crypto/encrypted-json";

interface DeliveryDestinationRow {
  readonly id: string;
  readonly owner_user_id: string;
  readonly type: DeliveryDestinationType;
  readonly label: string;
  readonly status: DeliveryDestinationStatus;
  readonly credential_ciphertext: string;
  readonly consecutive_failures: number;
  readonly last_success_at: string | null;
  readonly last_failure_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export class D1DeliveryDestinationRepository implements DeliveryDestinationRepository {
  constructor(
    private readonly database: D1Database,
    private readonly keyMaterial: string,
  ) {}

  async create(input: NewDeliveryDestination): Promise<DeliveryDestination> {
    const type = input.credential.kind;
    const credentialCiphertext = await encryptJson(
      input.credential,
      this.keyMaterial,
    );
    await this.database
      .prepare(
        `INSERT INTO delivery_destinations
         (id, owner_user_id, type, label, status, credential_ciphertext, consecutive_failures, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', ?, 0, ?, ?)`,
      )
      .bind(
        input.id,
        input.ownerUserId,
        type,
        input.label,
        credentialCiphertext,
        input.createdAt,
        input.createdAt,
      )
      .run();
    const created = await this.findById(input.id);
    if (created === null) throw new Error("DESTINATION_CREATE_FAILED");
    return created;
  }

  async replaceCredential(input: {
    readonly ownerUserId: string;
    readonly id: string;
    readonly label: string;
    readonly credential: DeliveryDestinationCredential;
    readonly updatedAt: string;
  }): Promise<DeliveryDestination | null> {
    const credentialCiphertext = await encryptJson(
      input.credential,
      this.keyMaterial,
    );
    const result = await this.database
      .prepare(
        `UPDATE delivery_destinations
         SET type = ?, label = ?, status = 'active',
             credential_ciphertext = ?, consecutive_failures = 0,
             updated_at = ?
         WHERE id = ? AND owner_user_id = ?`,
      )
      .bind(
        input.credential.kind,
        input.label,
        credentialCiphertext,
        input.updatedAt,
        input.id,
        input.ownerUserId,
      )
      .run();
    return result.meta.changes === 1 ? this.findById(input.id) : null;
  }

  async findById(id: string): Promise<DeliveryDestination | null> {
    const row = await this.database
      .prepare("SELECT * FROM delivery_destinations WHERE id = ?")
      .bind(id)
      .first<DeliveryDestinationRow>();
    return row === null ? null : this.fromRow(row);
  }

  async findByOwner(ownerUserId: string): Promise<DeliveryDestination[]> {
    const rows = await this.database
      .prepare(
        `SELECT * FROM delivery_destinations
         WHERE owner_user_id = ?
         ORDER BY updated_at DESC, created_at DESC`,
      )
      .bind(ownerUserId)
      .all<DeliveryDestinationRow>();
    return Promise.all(rows.results.map((row) => this.fromRow(row)));
  }

  async findSlackChannel(
    ownerUserId: string,
    workspaceId: string,
    channelId: string,
  ): Promise<DeliveryDestination | null> {
    const destinations = await this.findByOwner(ownerUserId);
    return (
      destinations.find(
        (destination) =>
          destination.credential.kind === "slack" &&
          destination.credential.workspaceId === workspaceId &&
          destination.credential.channelId === channelId,
      ) ?? null
    );
  }

  async setEnabled(
    ownerUserId: string,
    id: string,
    enabled: boolean,
    updatedAt: string,
  ): Promise<boolean> {
    const result = await this.database
      .prepare(
        `UPDATE delivery_destinations
         SET status = ?, consecutive_failures = CASE WHEN ? = 'active' THEN 0 ELSE consecutive_failures END, updated_at = ?
         WHERE id = ? AND owner_user_id = ?`,
      )
      .bind(
        enabled ? "active" : "disabled",
        enabled ? "active" : "disabled",
        updatedAt,
        id,
        ownerUserId,
      )
      .run();
    return result.meta.changes === 1;
  }

  async delete(ownerUserId: string, id: string): Promise<boolean> {
    const result = await this.database
      .prepare(
        "DELETE FROM delivery_destinations WHERE id = ? AND owner_user_id = ?",
      )
      .bind(id, ownerUserId)
      .run();
    return result.meta.changes === 1;
  }

  async markSucceeded(id: string, occurredAt: string): Promise<void> {
    await this.database
      .prepare(
        `UPDATE delivery_destinations
         SET status = CASE WHEN status = 'disabled' THEN status ELSE 'active' END,
             consecutive_failures = 0, last_success_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(occurredAt, occurredAt, id)
      .run();
  }

  async markFailed(id: string, occurredAt: string): Promise<void> {
    await this.database
      .prepare(
        `UPDATE delivery_destinations
         SET consecutive_failures = consecutive_failures + 1,
             status = CASE
               WHEN status = 'disabled' THEN status
               WHEN consecutive_failures + 1 >= 3 THEN 'failing'
               ELSE status
             END,
             last_failure_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(occurredAt, occurredAt, id)
      .run();
  }

  private async fromRow(
    row: DeliveryDestinationRow,
  ): Promise<DeliveryDestination> {
    const credential = await decryptJson<DeliveryDestinationCredential>(
      row.credential_ciphertext,
      this.keyMaterial,
    );
    if (credential.kind !== row.type) {
      throw new Error("DESTINATION_CREDENTIAL_TYPE_MISMATCH");
    }
    return {
      id: row.id,
      ownerUserId: row.owner_user_id,
      type: row.type,
      label: row.label,
      status: row.status,
      credential,
      consecutiveFailures: row.consecutive_failures,
      ...(row.last_success_at === null
        ? {}
        : { lastSuccessAt: row.last_success_at }),
      ...(row.last_failure_at === null
        ? {}
        : { lastFailureAt: row.last_failure_at }),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
