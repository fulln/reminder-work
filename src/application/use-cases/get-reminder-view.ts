import { failure, success } from "../contracts/action-result";
import type { ActionResult } from "../contracts/action-result";
import type { Clock } from "../ports/clock";
import type { ContentProtector } from "../ports/content-protector";
import type { ReminderRepository } from "../ports/reminder-repository";
import type { TokenPort } from "../ports/token";
import type { ReminderStatus } from "../../domain/reminder/reminder";
import type { ReminderSchedule } from "../../domain/reminder/schedule";

export type ReminderAction = "complete" | "snooze" | "reschedule" | "cancel";

export interface ReminderView {
  readonly title: string;
  readonly version: number;
  readonly status: ReminderStatus;
  readonly schedule: ReminderSchedule;
  readonly actions: readonly ReminderAction[];
}

export interface ReminderViewDependencies {
  readonly clock: Clock;
  readonly reminders: ReminderRepository;
  readonly tokens: TokenPort;
  readonly contentProtector: ContentProtector;
}

export function availableReminderActions(
  status: ReminderStatus,
): readonly ReminderAction[] {
  return status === "active" || status === "snoozed"
    ? ["complete", "snooze", "reschedule", "cancel"]
    : [];
}

export async function getReminderView(
  dependencies: ReminderViewDependencies,
  token: string,
  requestId: string,
): Promise<ActionResult<ReminderView>> {
  const claims = await dependencies.tokens.resolve(token, "manage");
  if (
    claims === null ||
    new Date(claims.expiresAt) <= dependencies.clock.now()
  ) {
    return unavailable(requestId);
  }
  const reminder = await dependencies.reminders.findById(claims.reminderId);
  if (reminder === null) return unavailable(requestId);

  try {
    const content = await dependencies.contentProtector.unprotect(
      reminder.contentCiphertext,
    );
    return success(requestId, {
      title: content.title,
      version: reminder.version,
      status: reminder.status,
      schedule: reminder.schedule,
      actions: availableReminderActions(reminder.status),
    });
  } catch {
    return unavailable(requestId);
  }
}

function unavailable(requestId: string): ActionResult<never> {
  return failure(requestId, {
    code: "MANAGEMENT_UNAVAILABLE",
    retryable: false,
    form: "This management link is invalid or has expired.",
  });
}
