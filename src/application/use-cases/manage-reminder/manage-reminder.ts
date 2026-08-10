import { failure, success } from "../../contracts/action-result";
import type { ActionResult } from "../../contracts/action-result";
import type { Clock } from "../../ports/clock";
import type { ReminderRepository } from "../../ports/reminder-repository";
import type { SuppressionRepository } from "../../ports/suppression-repository";
import type { TokenPort } from "../../ports/token";
import { canTransition } from "../../../domain/reminder/reminder";
import type {
  Reminder,
  ReminderStatus,
} from "../../../domain/reminder/reminder";

export interface ManageReminderDependencies {
  readonly clock: Clock;
  readonly reminders: ReminderRepository;
  readonly tokens: TokenPort;
  readonly suppressions: SuppressionRepository;
}

export type ManageReminderInput =
  | {
      readonly token: string;
      readonly expectedVersion: number;
      readonly action: "complete" | "cancel";
    }
  | {
      readonly token: string;
      readonly expectedVersion: number;
      readonly action: "snooze";
      readonly minutes: number;
    }
  | {
      readonly token: string;
      readonly expectedVersion: number;
      readonly action: "reschedule";
      readonly resolvedUtc: string;
      readonly anchorLocal: string;
    };

export async function manageReminder(
  dependencies: ManageReminderDependencies,
  input: ManageReminderInput,
  requestId: string,
): Promise<
  ActionResult<{ readonly state: ReminderStatus; readonly version: number }>
> {
  const claims = await dependencies.tokens.resolve(input.token, "manage");
  if (
    claims === null ||
    new Date(claims.expiresAt) <= dependencies.clock.now()
  ) {
    return unavailable(requestId);
  }
  const reminder = await dependencies.reminders.findById(claims.reminderId);
  if (reminder === null) return unavailable(requestId);
  if (
    (input.action === "complete" && reminder.status === "completed") ||
    (input.action === "cancel" && reminder.status === "cancelled")
  ) {
    return success(requestId, {
      state: reminder.status,
      version: reminder.version,
    });
  }
  if (reminder.version !== input.expectedVersion) return conflict(requestId);
  if (await dependencies.suppressions.isSuppressed(reminder.recipientRef)) {
    return unavailable(requestId);
  }

  const now = dependencies.clock.now();
  const next = transition(reminder, input, now);
  if (next === null) return unavailable(requestId);
  const saved = await dependencies.reminders.save(next, input.expectedVersion);
  return saved
    ? success(requestId, { state: next.status, version: next.version })
    : conflict(requestId);
}

function transition(
  reminder: Reminder,
  input: ManageReminderInput,
  now: Date,
): Reminder | null {
  const target: ReminderStatus =
    input.action === "complete"
      ? "completed"
      : input.action === "cancel"
        ? "cancelled"
        : input.action === "snooze"
          ? "snoozed"
          : "active";
  if (input.action !== "reschedule" && !canTransition(reminder.status, target))
    return null;
  if (
    input.action === "reschedule" &&
    !["active", "snoozed"].includes(reminder.status)
  )
    return null;

  let schedule = reminder.schedule;
  if (input.action === "snooze") {
    const minutes = Math.min(10_080, Math.max(1, Math.trunc(input.minutes)));
    schedule = {
      ...schedule,
      resolvedUtc: new Date(now.getTime() + minutes * 60_000).toISOString(),
    };
  } else if (input.action === "reschedule") {
    const resolved = new Date(input.resolvedUtc);
    if (Number.isNaN(resolved.getTime()) || resolved <= now) return null;
    schedule = {
      ...schedule,
      resolvedUtc: resolved.toISOString(),
      anchorLocal: input.anchorLocal,
    };
  }
  return {
    ...reminder,
    status: target,
    schedule,
    version: reminder.version + 1,
    updatedAt: now.toISOString(),
  };
}

function unavailable(requestId: string): ActionResult<never> {
  return failure(requestId, {
    code: "MANAGEMENT_UNAVAILABLE",
    retryable: false,
    form: "This management link is invalid or unavailable.",
  });
}

function conflict(requestId: string): ActionResult<never> {
  return failure(requestId, {
    code: "REMINDER_CONFLICT",
    retryable: true,
    form: "The reminder changed. Reload this link.",
  });
}
