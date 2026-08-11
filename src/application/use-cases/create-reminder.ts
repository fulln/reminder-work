import { failure, success } from "../contracts/action-result";
import type { ActionResult } from "../contracts/action-result";
import type { ReminderDraftInput } from "../contracts/create-reminder";
import type { Clock } from "../ports/clock";
import type { ContentProtector } from "../ports/content-protector";
import type { IdGenerator } from "../ports/id-generator";
import type { PendingReminderStore } from "../ports/pending-reminder-store";
import type { PushSubscriptionRepository } from "../ports/push-subscription-repository";
import type { ReminderRepository } from "../ports/reminder-repository";
import type { ReminderSchedulerPort } from "../ports/reminder-scheduler";
import type { TokenPort } from "../ports/token";
import type { TurnstilePort } from "../ports/turnstile";
import type { Reminder } from "../../domain/reminder/reminder";
import {
  createDeliveryPlan,
  includesEmail,
} from "../../domain/reminder/delivery-plan";
import { reviewReminderForCreate } from "./review-reminder";

export interface CreateReminderDependencies {
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly turnstile: TurnstilePort;
  readonly contentProtector: ContentProtector;
  readonly pendingStore: PendingReminderStore;
  readonly reminders: ReminderRepository;
  readonly pushSubscriptions: PushSubscriptionRepository;
  readonly scheduler: ReminderSchedulerPort;
  readonly tokens: TokenPort;
}

export type CreateReminderAccepted =
  | {
      readonly state: "pending_verification";
      readonly maskedRecipient: string;
      readonly expiresAt: string;
      readonly verificationToken: string;
    }
  | {
      readonly state: "active";
      readonly channels: readonly ["web_push"];
      readonly manageToken: string;
    };

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
  const review = reviewReminderForCreate(input);
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
  const id = dependencies.ids.create();
  const pushSubscriptionId =
    review.value.pushSubscription === undefined
      ? undefined
      : await dependencies.pushSubscriptions.upsert(
          review.value.pushSubscription,
          now.toISOString(),
        );
  const deliveryPlan = createDeliveryPlan(
    review.value.deliveryMode,
    pushSubscriptionId,
  );
  const emailRequired = includesEmail(deliveryPlan);
  const recipientIdentity =
    review.value.recipientEmail ?? `push:${String(pushSubscriptionId)}`;
  const protectedContent = await dependencies.contentProtector.protect(
    review.value.title,
    review.value.recipientEmail,
    recipientIdentity,
  );
  const reminder: Reminder = {
    id,
    version: 1,
    status: emailRequired ? "pending_verification" : "active",
    schedule: review.value.schedule,
    deliveryPlan,
    recipientRef: protectedContent.recipientRef,
    contentCiphertext: protectedContent.ciphertext,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  if (emailRequired) {
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
    const verificationToken = await dependencies.tokens.issue({
      reminderId: id,
      purpose: "verify",
      expiresAt,
    });
    await dependencies.pendingStore.createPending(reminder, requestId);
    return success(requestId, {
      state: "pending_verification",
      maskedRecipient: maskEmail(review.value.recipientEmail ?? ""),
      expiresAt,
      verificationToken,
    });
  }

  await dependencies.reminders.create(reminder, requestId);
  try {
    await dependencies.scheduler.schedule({
      schemaVersion: 1,
      reminderId: reminder.id,
      expectedVersion: reminder.version,
      dueAt: reminder.schedule.resolvedUtc,
      idempotencyKey: `${reminder.id}:${String(reminder.version)}:${reminder.schedule.resolvedUtc}`,
      traceId: requestId,
    });
  } catch {
    // The D1 outbox remains authoritative; reconciliation can retry workflow creation.
  }
  const manageToken = await dependencies.tokens.issue({
    reminderId: id,
    purpose: "manage",
    expiresAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  });
  return success(requestId, {
    state: "active",
    channels: ["web_push"],
    manageToken,
  });
}
