import { failure, success } from "../contracts/action-result";
import type { ActionResult } from "../contracts/action-result";
import type { CalendarFeedStore } from "../ports/calendar-feed-store";
import type { Clock } from "../ports/clock";
import type { EmailIdentityRepository } from "../ports/email-identity-repository";
import type { ReminderRepository } from "../ports/reminder-repository";
import type { ReminderSchedulerPort } from "../ports/reminder-scheduler";
import type { TokenPort } from "../ports/token";

export interface VerifyReminderDependencies {
  readonly clock: Clock;
  readonly reminders: ReminderRepository;
  readonly tokens: TokenPort;
  readonly scheduler: ReminderSchedulerPort;
  readonly calendarFeeds: CalendarFeedStore;
  readonly emailIdentities?: EmailIdentityRepository;
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
  const claims = await dependencies.tokens.resolve(token, "verify");
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

  const verifiedAt = dependencies.clock.now().toISOString();
  if (
    reminder.ownerUserId !== null &&
    reminder.ownerUserId !== undefined &&
    dependencies.emailIdentities !== undefined
  ) {
    try {
      const identity =
        await dependencies.emailIdentities.findByOwnerAndRecipientRef(
          reminder.ownerUserId,
          reminder.recipientRef,
        );
      if (identity !== null && identity.status !== "verified") {
        await dependencies.emailIdentities.markVerified(
          reminder.ownerUserId,
          identity.id,
          verifiedAt,
        );
      }
    } catch {
      return failure(requestId, {
        code: "VERIFICATION_RETRYABLE",
        retryable: true,
        form: "We could not verify this reminder yet. Open the link again to retry.",
      });
    }
  }

  const manageExpiresAt = new Date(
    dependencies.clock.now().getTime() + 90 * 24 * 60 * 60 * 1000,
  ).toISOString();
  let manageToken: string;
  let unsubscribeToken: string;
  try {
    [manageToken, unsubscribeToken] = await Promise.all([
      dependencies.tokens.issue({
        reminderId: reminder.id,
        purpose: "manage",
        expiresAt: manageExpiresAt,
      }),
      dependencies.tokens.issue({
        reminderId: reminder.id,
        purpose: "unsubscribe",
        expiresAt: manageExpiresAt,
      }),
    ]);
  } catch {
    return failure(requestId, {
      code: "VERIFICATION_RETRYABLE",
      retryable: true,
      form: "We could not verify this reminder yet. Open the link again to retry.",
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
      await dependencies.tokens.consume(token, "verify");
    } catch {
      // Active reminder state prevents replay; consumption cleanup is best effort.
    }
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
