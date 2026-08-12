import { canTransition } from "../../../domain/reminder/reminder";
import type {
  Reminder,
  ReminderStatus,
} from "../../../domain/reminder/reminder";

export type ReminderAction = "complete" | "snooze" | "reschedule" | "cancel";

export function availableReminderActions(
  status: ReminderStatus,
): readonly ReminderAction[] {
  return status === "active" || status === "snoozed"
    ? ["complete", "snooze", "reschedule", "cancel"]
    : [];
}

export type ReminderMutationInput =
  | {
      readonly expectedVersion: number;
      readonly action: "complete" | "cancel";
    }
  | {
      readonly expectedVersion: number;
      readonly action: "snooze";
      readonly minutes: number;
    }
  | {
      readonly expectedVersion: number;
      readonly action: "reschedule";
      readonly resolvedUtc: string;
      readonly anchorLocal: string;
    };

export function transitionReminder(
  reminder: Reminder,
  input: ReminderMutationInput,
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
  ) {
    return null;
  }

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
