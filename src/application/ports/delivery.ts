export interface DeliveryRequest {
  readonly schemaVersion: 1;
  readonly reminderId: string;
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
}

export interface DeliveryPort {
  enqueue(request: DeliveryRequest): Promise<void>;
}
