export interface ScheduleReminderRequest {
  readonly schemaVersion: 1;
  readonly reminderId: string;
  readonly expectedVersion: number;
  readonly dueAt: string;
  readonly idempotencyKey: string;
  readonly traceId: string;
}

export interface ReminderSchedulerPort {
  schedule(request: ScheduleReminderRequest): Promise<void>;
}
