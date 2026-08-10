import { failure, success } from "../contracts/action-result";
import type { ActionResult } from "../contracts/action-result";
import type { Clock } from "../ports/clock";
import type { ReminderRepository } from "../ports/reminder-repository";
import type { SuppressionRepository } from "../ports/suppression-repository";
import type { TokenPort } from "../ports/token";
import { isTerminal } from "../../domain/reminder/reminder";

export interface UnsubscribeDependencies {
  readonly clock: Clock;
  readonly reminders: ReminderRepository;
  readonly suppressions: SuppressionRepository;
  readonly tokens: TokenPort;
}

export async function unsubscribe(
  dependencies: UnsubscribeDependencies,
  token: string,
  requestId: string,
): Promise<ActionResult<{ readonly state: "unsubscribed" }>> {
  const claims = await dependencies.tokens.resolve(token, "unsubscribe");
  if (
    claims === null ||
    new Date(claims.expiresAt) <= dependencies.clock.now()
  ) {
    return failure(requestId, {
      code: "UNSUBSCRIBE_UNAVAILABLE",
      retryable: false,
      form: "This unsubscribe link is invalid or expired.",
    });
  }
  const reminder = await dependencies.reminders.findById(claims.reminderId);
  if (reminder === null) {
    return failure(requestId, {
      code: "UNSUBSCRIBE_UNAVAILABLE",
      retryable: false,
      form: "This unsubscribe link is invalid or expired.",
    });
  }
  const now = dependencies.clock.now().toISOString();
  await dependencies.suppressions.suppress(reminder.recipientRef, now);
  if (!isTerminal(reminder.status)) {
    await dependencies.reminders.save(
      {
        ...reminder,
        status: "cancelled",
        version: reminder.version + 1,
        updatedAt: now,
      },
      reminder.version,
    );
  }
  return success(requestId, { state: "unsubscribed" });
}
