import { failure, success } from "../contracts/action-result";
import type { ActionResult } from "../contracts/action-result";
import type { Clock } from "../ports/clock";
import type { ContentProtector } from "../ports/content-protector";
import type { OwnedReminderStore } from "../ports/owned-reminder-store";
import type { ReminderRepository } from "../ports/reminder-repository";
import type { ReminderStatus } from "../../domain/reminder/reminder";
import type { ReminderSchedule } from "../../domain/reminder/schedule";
import { maskEmail } from "../support/email-address";
import {
  availableReminderActions,
  transitionReminder,
  type ReminderAction,
  type ReminderMutationInput,
} from "./manage-reminder/reminder-management";

export interface OwnedReminderSummary {
  readonly id: string;
  readonly title: string;
  readonly status: ReminderStatus;
  readonly schedule: ReminderSchedule;
  readonly deliveryLabel: string;
  readonly maskedRecipient: string;
  readonly updatedAt: string;
}

export interface OwnedReminderView extends OwnedReminderSummary {
  readonly version: number;
  readonly actions: readonly ReminderAction[];
}

export async function listOwnedReminders(
  dependencies: {
    readonly reminders: OwnedReminderStore;
    readonly contentProtector: ContentProtector;
  },
  userId: string,
  requestId: string,
): Promise<ActionResult<{ readonly items: OwnedReminderSummary[] }>> {
  const reminders = await dependencies.reminders.findByOwner(userId);
  try {
    const items = await Promise.all(
      reminders.map(async (reminder) => {
        const content = await dependencies.contentProtector.unprotect(
          reminder.contentCiphertext,
        );
        return {
          id: reminder.id,
          title: content.title,
          status: reminder.status,
          schedule: reminder.schedule,
          deliveryLabel: deliveryLabel(reminder.deliveryPlan.mode),
          maskedRecipient:
            content.recipientEmail === undefined
              ? "This browser"
              : maskEmail(content.recipientEmail),
          updatedAt: reminder.updatedAt,
        } satisfies OwnedReminderSummary;
      }),
    );
    return success(requestId, { items });
  } catch {
    return ownedReminderUnavailable(requestId);
  }
}

export async function getOwnedReminderView(
  dependencies: {
    readonly reminders: ReminderRepository;
    readonly contentProtector: ContentProtector;
  },
  userId: string,
  reminderId: string,
  requestId: string,
): Promise<ActionResult<OwnedReminderView>> {
  const reminder = await dependencies.reminders.findById(reminderId);
  if (reminder?.ownerUserId !== userId) {
    return ownedReminderUnavailable(requestId);
  }
  try {
    const content = await dependencies.contentProtector.unprotect(
      reminder.contentCiphertext,
    );
    return success(requestId, {
      id: reminder.id,
      title: content.title,
      version: reminder.version,
      status: reminder.status,
      schedule: reminder.schedule,
      actions: availableReminderActions(reminder.status),
      deliveryLabel: deliveryLabel(reminder.deliveryPlan.mode),
      maskedRecipient:
        content.recipientEmail === undefined
          ? "This browser"
          : maskEmail(content.recipientEmail),
      updatedAt: reminder.updatedAt,
    });
  } catch {
    return ownedReminderUnavailable(requestId);
  }
}

export async function manageOwnedReminder(
  dependencies: {
    readonly clock: Clock;
    readonly reminders: ReminderRepository;
  },
  userId: string,
  reminderId: string,
  input: ReminderMutationInput,
  requestId: string,
): Promise<
  ActionResult<{ readonly state: ReminderStatus; readonly version: number }>
> {
  const reminder = await dependencies.reminders.findById(reminderId);
  if (reminder?.ownerUserId !== userId) {
    return ownedReminderUnavailable(requestId);
  }
  if (
    (input.action === "complete" && reminder.status === "completed") ||
    (input.action === "cancel" && reminder.status === "cancelled")
  ) {
    return success(requestId, {
      state: reminder.status,
      version: reminder.version,
    });
  }
  if (reminder.version !== input.expectedVersion) {
    return failure(requestId, {
      code: "REMINDER_CONFLICT",
      retryable: true,
      form: "The reminder changed. Reload and try again.",
    });
  }

  const next = transitionReminder(reminder, input, dependencies.clock.now());
  if (next === null) return ownedReminderUnavailable(requestId);
  const saved = await dependencies.reminders.save(next, input.expectedVersion);
  return saved
    ? success(requestId, { state: next.status, version: next.version })
    : failure(requestId, {
        code: "REMINDER_CONFLICT",
        retryable: true,
        form: "The reminder changed. Reload and try again.",
      });
}

function deliveryLabel(
  mode: "email" | "web_push" | "web_push_email_fallback",
): string {
  return mode === "email"
    ? "Email"
    : mode === "web_push"
      ? "Browser notification"
      : "Browser notification + email fallback";
}

function ownedReminderUnavailable(requestId: string): ActionResult<never> {
  return failure(requestId, {
    code: "REMINDER_NOT_FOUND",
    retryable: false,
    form: "This reminder is unavailable.",
  });
}
