import type { Reminder } from "../../domain/reminder/reminder";

export interface CalendarFeedStore {
  issue(recipientRef: string, createdAt: string): Promise<string>;
  findReminders(token: string): Promise<readonly Reminder[] | null>;
}
