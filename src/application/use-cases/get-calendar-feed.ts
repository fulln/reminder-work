import type { CalendarFeedStore } from "../ports/calendar-feed-store";
import type { ContentProtector } from "../ports/content-protector";
import { exportReminderCalendarFeed } from "./export-calendar";

export async function getCalendarFeed(
  dependencies: {
    readonly feeds: CalendarFeedStore;
    readonly contentProtector: ContentProtector;
    readonly now: () => Date;
  },
  token: string,
): Promise<string | null> {
  const reminders = await dependencies.feeds.findReminders(token);
  if (reminders === null) return null;

  const entries = await Promise.all(
    reminders.map(async (reminder) => {
      const content = await dependencies.contentProtector.unprotect(
        reminder.contentCiphertext,
      );
      return {
        id: reminder.id,
        version: reminder.version,
        title: content.title,
        schedule: reminder.schedule,
        updatedAt: reminder.updatedAt,
      };
    }),
  );
  return exportReminderCalendarFeed(entries, { now: dependencies.now() });
}
