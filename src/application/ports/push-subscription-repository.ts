import type { PushSubscriptionInput } from "../contracts/push-subscription";

export interface StoredPushSubscription extends PushSubscriptionInput {
  readonly id: string;
}

export interface PushSubscriptionRepository {
  upsert(subscription: PushSubscriptionInput, now: string): Promise<string>;
  findActiveById(id: string): Promise<StoredPushSubscription | null>;
  revoke(id: string, now: string): Promise<void>;
}
