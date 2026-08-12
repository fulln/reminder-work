import type { Reminder } from "../../domain/reminder/reminder";

export interface OwnedReminderStore {
  findByOwner(ownerUserId: string): Promise<Reminder[]>;
}
