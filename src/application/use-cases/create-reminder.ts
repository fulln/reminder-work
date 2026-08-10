import { failure, success } from "../contracts/action-result";
import type { ActionResult } from "../contracts/action-result";
import type { ReminderDraftInput } from "../contracts/create-reminder";
import type { Clock } from "../ports/clock";
import type { ContentProtector } from "../ports/content-protector";
import type { IdGenerator } from "../ports/id-generator";
import type { PendingReminderStore } from "../ports/pending-reminder-store";
import type { TokenPort } from "../ports/token";
import type { TurnstilePort } from "../ports/turnstile";
import type { Reminder } from "../../domain/reminder/reminder";
import { reviewReminder } from "./review-reminder";

export interface CreateReminderDependencies {
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly turnstile: TurnstilePort;
  readonly contentProtector: ContentProtector;
  readonly pendingStore: PendingReminderStore;
  readonly tokens: TokenPort;
}

export interface CreateReminderAccepted {
  readonly state: "pending_verification";
  readonly maskedRecipient: string;
  readonly expiresAt: string;
  readonly verificationToken: string;
}

function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  const shown =
    local.length <= 2
      ? `${local.slice(0, 1)}*`
      : `${local.slice(0, 1)}${"*".repeat(Math.min(3, local.length - 2))}${local.slice(-1)}`;
  return `${shown}@${domain}`;
}

export async function createReminder(
  dependencies: CreateReminderDependencies,
  input: ReminderDraftInput,
  requestId: string,
): Promise<ActionResult<CreateReminderAccepted>> {
  const review = reviewReminder(input);
  if (!review.ok) {
    return failure(requestId, {
      code: "REMINDER_INPUT_INVALID",
      retryable: false,
      fields: review.fields,
      form: "Review the highlighted fields.",
    });
  }

  if (!(await dependencies.turnstile.verify(review.value.turnstileToken))) {
    return failure(requestId, {
      code: "TURNSTILE_REJECTED",
      retryable: true,
      fields: { turnstileToken: ["Complete the security check again."] },
    });
  }

  const now = dependencies.clock.now();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
  const id = dependencies.ids.create();
  const protectedContent = await dependencies.contentProtector.protect(
    review.value.title,
    review.value.recipientEmail,
  );
  const reminder: Reminder = {
    id,
    version: 1,
    status: "pending_verification",
    schedule: review.value.schedule,
    recipientRef: protectedContent.recipientRef,
    contentCiphertext: protectedContent.ciphertext,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  const verificationToken = await dependencies.tokens.issue({
    reminderId: id,
    purpose: "verify",
    expiresAt,
  });
  await dependencies.pendingStore.createPending(reminder, requestId);

  return success(requestId, {
    state: "pending_verification",
    maskedRecipient: maskEmail(review.value.recipientEmail),
    expiresAt,
    verificationToken,
  });
}
