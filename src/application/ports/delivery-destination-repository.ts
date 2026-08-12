export type DeliveryDestinationType = "slack" | "webhook";
export type DeliveryDestinationStatus = "active" | "failing" | "disabled";

export interface SlackDestinationCredential {
  readonly kind: "slack";
  readonly webhookUrl: string;
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly channelId: string;
  readonly channelName: string;
  readonly accessToken?: string;
}

export interface WebhookDestinationCredential {
  readonly kind: "webhook";
  readonly url: string;
  readonly signingSecret: string;
}

export type DeliveryDestinationCredential =
  SlackDestinationCredential | WebhookDestinationCredential;

export interface DeliveryDestination {
  readonly id: string;
  readonly ownerUserId: string;
  readonly type: DeliveryDestinationType;
  readonly label: string;
  readonly status: DeliveryDestinationStatus;
  readonly credential: DeliveryDestinationCredential;
  readonly consecutiveFailures: number;
  readonly lastSuccessAt?: string;
  readonly lastFailureAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface NewDeliveryDestination {
  readonly id: string;
  readonly ownerUserId: string;
  readonly label: string;
  readonly credential: DeliveryDestinationCredential;
  readonly createdAt: string;
}

export interface DeliveryDestinationRepository {
  create(input: NewDeliveryDestination): Promise<DeliveryDestination>;
  replaceCredential(input: {
    readonly ownerUserId: string;
    readonly id: string;
    readonly label: string;
    readonly credential: DeliveryDestinationCredential;
    readonly updatedAt: string;
  }): Promise<DeliveryDestination | null>;
  findById(id: string): Promise<DeliveryDestination | null>;
  findByOwner(ownerUserId: string): Promise<DeliveryDestination[]>;
  findSlackChannel(
    ownerUserId: string,
    workspaceId: string,
    channelId: string,
  ): Promise<DeliveryDestination | null>;
  setEnabled(
    ownerUserId: string,
    id: string,
    enabled: boolean,
    updatedAt: string,
  ): Promise<boolean>;
  delete(ownerUserId: string, id: string): Promise<boolean>;
  markSucceeded(id: string, occurredAt: string): Promise<void>;
  markFailed(id: string, occurredAt: string): Promise<void>;
}
