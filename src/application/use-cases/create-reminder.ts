import { failure, success } from "../contracts/action-result";
import type { ActionResult } from "../contracts/action-result";
import type { ReminderDraftInput } from "../contracts/create-reminder";
import type { Clock } from "../ports/clock";
import type { ContentProtector } from "../ports/content-protector";
import type { EmailIdentityRepository } from "../ports/email-identity-repository";
import type { EmailReminderCreationLimiter } from "../ports/email-reminder-creation-limiter";
import type { IdGenerator } from "../ports/id-generator";
import type { PushSubscriptionRepository } from "../ports/push-subscription-repository";
import type { ReminderRepository } from "../ports/reminder-repository";
import type { ReminderSchedulerPort } from "../ports/reminder-scheduler";
import type { SuppressionRepository } from "../ports/suppression-repository";
import type { TokenPort } from "../ports/token";
import type { TurnstilePort } from "../ports/turnstile";
import type { Reminder } from "../../domain/reminder/reminder";
import {
  createDeliveryPlan,
  includesEmail,
} from "../../domain/reminder/delivery-plan";
import { reviewReminderForCreate } from "./review-reminder";

const DAY_MS = 24 * 60 * 60 * 1000;
const ANONYMOUS_DAILY_LIMIT = 3;
const AUTHENTICATED_DAILY_LIMIT = 25;
const RECIPIENT_DAILY_LIMIT = 10;

export interface CreateReminderDependencies {
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly turnstile: TurnstilePort;
  readonly contentProtector: ContentProtector;
  readonly reminders: ReminderRepository;
  readonly suppressions: SuppressionRepository;
  readonly emailCreationLimiter: EmailReminderCreationLimiter;
  readonly pushSubscriptions: PushSubscriptionRepository;
  readonly scheduler: ReminderSchedulerPort;
  readonly tokens: TokenPort;
  readonly emailIdentities?: EmailIdentityRepository;
}

export interface CreateReminderAccepted {
  readonly state: "active";
  readonly channels: readonly ("email" | "web_push")[];
  readonly manageToken: string;
}

export interface CreateReminderOptions {
  readonly ownerUserId?: string | null;
  readonly actorRef?: string;
}

function channelsFor(
  plan: Reminder["deliveryPlan"],
): readonly ("email" | "web_push")[] {
  return [...new Set(plan.targets.map((target) => target.channel))];
}

export async function createReminder(
  dependencies: CreateReminderDependencies,
  input: ReminderDraftInput,
  requestId: string,
  options: CreateReminderOptions = {},
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
  const ownerUserId = options.ownerUserId ?? null;
  const recipientEmail = review.value.recipientEmail;
  const recipientIdentity =
    recipientEmail ?? `push:${String(pushSubscriptionId)}`;
  const protectedContent = await dependencies.contentProtector.protect(
    review.value.title,
    recipientEmail,
    recipientIdentity,
  );

  if (emailRequired) {
    if (recipientEmail === undefined) {
      return failure(requestId, {
        code: "REMINDER_INPUT_INVALID",
        retryable: false,
        fields: { recipientEmail: ["Enter a valid email address."] },
        form: "Review the highlighted fields.",
      });
    }
    const suppressionRefs = [
      protectedContent.recipientRef,
      ...(protectedContent.legacyRecipientRef === undefined
        ? []
        : [protectedContent.legacyRecipientRef]),
    ];
    if (
      (
        await Promise.all(
          suppressionRefs.map((recipientRef) =>
            dependencies.suppressions.isSuppressed(recipientRef),
          ),
        )
      ).some(Boolean)
    ) {
      return failure(requestId, {
        code: "RECIPIENT_UNSUBSCRIBED",
        retryable: false,
        fields: {
          recipientEmail: [
            "This address has opted out of Reminders.work email delivery.",
          ],
        },
        form: "This recipient has chosen not to receive reminder emails.",
      });
    }
    const reserved = await dependencies.emailCreationLimiter.reserve({
      id,
      actorRef: options.actorRef ?? `request:${requestId}`,
      recipientRef: protectedContent.recipientRef,
      createdAt: now.toISOString(),
      discardBefore: new Date(now.getTime() - DAY_MS).toISOString(),
      actorLimit:
        ownerUserId === null
          ? ANONYMOUS_DAILY_LIMIT
          : AUTHENTICATED_DAILY_LIMIT,
      recipientLimit: RECIPIENT_DAILY_LIMIT,
    });
    if (!reserved) {
      return failure(requestId, {
        code: "EMAIL_CREATION_RATE_LIMITED",
        retryable: true,
        form: "Email reminder limit reached. Try again after 24 hours.",
      });
    }
  }

  const reminder: Reminder = {
    id,
    ownerUserId,
    version: 1,
    status: "active",
    schedule: review.value.schedule,
    deliveryPlan,
    recipientRef: protectedContent.recipientRef,
    contentCiphertext: protectedContent.ciphertext,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  await dependencies.reminders.create(reminder, requestId);
  if (
    emailRequired &&
    ownerUserId !== null &&
    recipientEmail !== undefined &&
    dependencies.emailIdentities !== undefined
  ) {
    try {
      await dependencies.emailIdentities.remember(
        ownerUserId,
        recipientEmail,
        now.toISOString(),
      );
    } catch {
      // Saved recipients are a convenience and never gate reminder creation.
    }
  }
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
    channels: channelsFor(deliveryPlan),
    manageToken,
  });
}
