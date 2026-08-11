import type { StoredPushSubscription } from "./push-subscription-repository";

export interface WebPushNotification {
  readonly title: string;
  readonly body: string;
  readonly url: string;
  readonly tag: string;
}

export type WebPushDeliveryResult = "sent" | "gone";

export interface WebPushDeliveryPort {
  send(
    subscription: StoredPushSubscription,
    notification: WebPushNotification,
  ): Promise<WebPushDeliveryResult>;
}
