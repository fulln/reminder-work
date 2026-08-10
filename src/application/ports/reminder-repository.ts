import type { Reminder } from "../../domain/reminder/reminder";

export interface ReminderRepository {
  create(reminder: Reminder, idempotencyKey: string): Promise<void>;
  findById(id: string): Promise<Reminder | null>;
  save(reminder: Reminder, expectedVersion: number): Promise<boolean>;
}
