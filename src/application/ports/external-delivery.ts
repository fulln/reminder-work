import type {
  SlackDestinationCredential,
  WebhookDestinationCredential,
} from "./delivery-destination-repository";

export interface ExternalDeliveryEvent {
  readonly schemaVersion: 1;
  readonly event: "reminder.due" | "delivery.test";
  readonly idempotencyKey: string;
  readonly occurredAt: string;
  readonly reminder: {
    readonly title: string;
    readonly dueAt: string;
    readonly manageUrl: string;
  };
}

export class ExternalDeliveryError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = "ExternalDeliveryError";
  }
}

export interface SlackDeliveryPort {
  send(
    credential: SlackDestinationCredential,
    event: ExternalDeliveryEvent,
  ): Promise<void>;
}

export interface WebhookDeliveryPort {
  send(
    credential: WebhookDestinationCredential,
    event: ExternalDeliveryEvent,
  ): Promise<void>;
}
