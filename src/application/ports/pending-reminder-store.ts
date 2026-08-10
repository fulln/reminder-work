import type { Reminder } from "../../domain/reminder/reminder";

export interface PendingReminderStore {
  createPending(reminder: Reminder, idempotencyKey: string): Promise<void>;
}
