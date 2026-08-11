import { failure, success } from "../contracts/action-result";
import type { ActionResult } from "../contracts/action-result";
import type { CalendarFeedStore } from "../ports/calendar-feed-store";
import type { Clock } from "../ports/clock";
import type { ReminderRepository } from "../ports/reminder-repository";
import type { ReminderSchedulerPort } from "../ports/reminder-scheduler";
import type { TokenPort } from "../ports/token";

export interface VerifyReminderDependencies {
  readonly clock: Clock;
  readonly reminders: ReminderRepository;
  readonly tokens: TokenPort;
  readonly scheduler: ReminderSchedulerPort;
  readonly calendarFeeds: CalendarFeedStore;
  readonly appOrigin: string;
}

export async function verifyReminder(
  dependencies: VerifyReminderDependencies,
  token: string,
  requestId: string,
): Promise<
  ActionResult<{
    readonly state: "active";
    readonly manageToken: string;
    readonly unsubscribeToken: string;
    readonly calendarSubscriptionUrl?: string;
    readonly calendarFeedUrl?: string;
  }>
> {
  const claims = await dependencies.tokens.consume(token, "verify");
  if (
    claims?.expiresAt === undefined ||
    new Date(claims.expiresAt) <= dependencies.clock.now()
  ) {
    return failure(requestId, {
      code: "VERIFICATION_UNAVAILABLE",
      retryable: false,
      form: "This verification link is invalid or has expired.",
    });
  }

  const reminder = await dependencies.reminders.findById(claims.reminderId);
  if (reminder?.status !== "pending_verification") {
    return failure(requestId, {
      code: "VERIFICATION_UNAVAILABLE",
      retryable: false,
      form: "This verification link is invalid or has expired.",
    });
  }

  const saved = await dependencies.reminders.save(
    {
      ...reminder,
      status: "active",
      version: reminder.version + 1,
      updatedAt: dependencies.clock.now().toISOString(),
    },
    reminder.version,
  );
  if (saved) {
    try {
      await dependencies.scheduler.schedule({
        schemaVersion: 1,
        reminderId: reminder.id,
        expectedVersion: reminder.version + 1,
        dueAt: reminder.schedule.resolvedUtc,
        idempotencyKey: `${reminder.id}:${String(reminder.version + 1)}:${reminder.schedule.resolvedUtc}`,
        traceId: requestId,
      });
    } catch {
      // The D1 outbox remains authoritative; reconciliation can retry workflow creation.
    }
    const expiresAt = new Date(
      dependencies.clock.now().getTime() + 90 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const [manageToken, unsubscribeToken] = await Promise.all([
      dependencies.tokens.issue({
        reminderId: reminder.id,
        purpose: "manage",
        expiresAt,
      }),
      dependencies.tokens.issue({
        reminderId: reminder.id,
        purpose: "unsubscribe",
        expiresAt,
      }),
    ]);
    let calendarLinks:
      | {
          readonly calendarSubscriptionUrl: string;
          readonly calendarFeedUrl: string;
        }
      | undefined;
    try {
      const calendarToken = await dependencies.calendarFeeds.issue(
        reminder.recipientRef,
        dependencies.clock.now().toISOString(),
      );
      const feedUrl = new URL(
        `/calendar/${encodeURIComponent(calendarToken)}.ics`,
        dependencies.appOrigin,
      ).toString();
      calendarLinks = {
        calendarFeedUrl: feedUrl,
        calendarSubscriptionUrl: feedUrl.replace(/^https?:/u, "webcal:"),
      };
    } catch {
      // Calendar subscription is optional and must not roll back verification.
    }
    return success(requestId, {
      state: "active",
      manageToken,
      unsubscribeToken,
      ...calendarLinks,
    });
  }
  return failure(requestId, {
    code: "REMINDER_CONFLICT",
    retryable: true,
    form: "The reminder changed. Open the link again.",
  });
}
