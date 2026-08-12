export type DeliveryAttemptStatus =
  "processing" | "sent" | "failed" | "skipped";

export interface DeliveryAttemptRepository {
  countRecentTests(destinationId: string, since: string): Promise<number>;
  record(input: {
    readonly idempotencyKey: string;
    readonly reminderId?: string;
    readonly destinationId: string;
    readonly eventType: "reminder.due" | "delivery.test";
    readonly status: DeliveryAttemptStatus;
    readonly failureCode?: string;
    readonly occurredAt: string;
  }): Promise<void>;
}
