import type { ContentProtector } from "../../../application/ports/content-protector";
import type { ReminderEmailPort } from "../../../application/ports/email-delivery";
import type { ReminderRepository } from "../../../application/ports/reminder-repository";
import type { SuppressionRepository } from "../../../application/ports/suppression-repository";
import type { TokenPort } from "../../../application/ports/token";
import type { DeliveryClaimRepository } from "../d1/delivery-claim-repository";
import type { PushSubscriptionRepository } from "../../../application/ports/push-subscription-repository";
import type { WebPushDeliveryPort } from "../../../application/ports/web-push-delivery";
import type { DeliveryDestinationRepository } from "../../../application/ports/delivery-destination-repository";
import type { DeliveryAttemptRepository } from "../../../application/ports/delivery-attempt-repository";
import {
  ExternalDeliveryError,
  type ExternalDeliveryEvent,
  type SlackDeliveryPort,
  type WebhookDeliveryPort,
} from "../../../application/ports/external-delivery";
import type { SafeLogger } from "../observability/redacted-logger";
import { deliveryDecision } from "./delivery-safety";
import { reminderDeliveryMessageSchema } from "./delivery-message";

export interface DeliveryMessageLike {
  readonly body: unknown;
  ack(): void;
  retry(): void;
}

export interface ProcessDeliveryDependencies {
  readonly reminders: ReminderRepository;
  readonly suppressions: SuppressionRepository;
  readonly claims: DeliveryClaimRepository;
  readonly protector: ContentProtector;
  readonly tokens: TokenPort;
  readonly email: ReminderEmailPort;
  readonly pushSubscriptions: PushSubscriptionRepository;
  readonly webPush: WebPushDeliveryPort;
  readonly destinations?: DeliveryDestinationRepository;
  readonly attempts?: DeliveryAttemptRepository;
  readonly slackDelivery?: SlackDeliveryPort;
  readonly webhookDelivery?: WebhookDeliveryPort;
  readonly logger: SafeLogger;
  readonly origin: string;
  now(): Date;
}

export async function processDeliveryMessage(
  dependencies: ProcessDeliveryDependencies,
  incoming: DeliveryMessageLike,
): Promise<void> {
  const parsed = reminderDeliveryMessageSchema.safeParse(incoming.body);
  if (!parsed.success) {
    dependencies.logger.error({
      operation: "delivery",
      outcome: "invalid-message",
      code: "DELIVERY_SCHEMA_INVALID",
    });
    incoming.ack();
    return;
  }
  const message = parsed.data;
  const reminder = await dependencies.reminders.findById(message.reminderId);
  if (reminder === null) {
    incoming.ack();
    return;
  }
  const decision = deliveryDecision(reminder, message.expectedVersion, false);
  if (decision !== "deliver") {
    dependencies.logger.info({
      operation: "delivery",
      outcome: decision,
      traceId: message.traceId,
      reminderId: reminder.id,
    });
    incoming.ack();
    return;
  }
  try {
    const now = dependencies.now();
    const content = await dependencies.protector.unprotect(
      reminder.contentCiphertext,
    );
    const expiresAt = new Date(
      now.getTime() + 90 * 24 * 60 * 60 * 1000,
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
    const manageUrl = `${dependencies.origin}/manage/${manageToken}`;
    const sendEmail = async (): Promise<void> => {
      if (content.recipientEmail === undefined) {
        throw new Error("EMAIL_DELIVERY_WITHOUT_RECIPIENT");
      }
      if (await dependencies.suppressions.isSuppressed(reminder.recipientRef)) {
        dependencies.logger.info({
          operation: "delivery",
          outcome: "skip-suppressed",
          traceId: message.traceId,
          reminderId: reminder.id,
        });
        return;
      }
      const claimKey = `${message.idempotencyKey}:email`;
      const claimed = await dependencies.claims.claim(
        claimKey,
        reminder.id,
        dependencies.now().toISOString(),
      );
      if (!claimed) return;
      try {
        await dependencies.email.sendReminder({
          to: content.recipientEmail,
          title: content.title,
          dueAt: reminder.schedule.resolvedUtc,
          manageUrl,
          unsubscribeUrl: `${dependencies.origin}/unsubscribe/${unsubscribeToken}`,
        });
        await dependencies.claims.markSent(
          claimKey,
          dependencies.now().toISOString(),
        );
      } catch (error) {
        await dependencies.claims.markFailed(
          claimKey,
          dependencies.now().toISOString(),
        );
        throw error;
      }
    };
    const sendPush = async (): Promise<"sent" | "gone"> => {
      const target = reminder.deliveryPlan.targets.find(
        (candidate) => candidate.channel === "web_push",
      );
      if (target?.channel !== "web_push") return "gone";
      const claimKey = `${message.idempotencyKey}:web_push:${target.subscriptionId}`;
      const claimed = await dependencies.claims.claim(
        claimKey,
        reminder.id,
        dependencies.now().toISOString(),
      );
      if (!claimed) return "sent";
      const subscription = await dependencies.pushSubscriptions.findActiveById(
        target.subscriptionId,
      );
      if (subscription === null) {
        await dependencies.claims.markSent(
          claimKey,
          dependencies.now().toISOString(),
        );
        return "gone";
      }
      try {
        const result = await dependencies.webPush.send(subscription, {
          title: "Reminder due",
          body: "Open Reminders.work to view and manage it.",
          url: manageUrl,
          tag: `reminder-${reminder.id}`,
        });
        if (result === "gone") {
          await dependencies.pushSubscriptions.revoke(
            subscription.id,
            dependencies.now().toISOString(),
          );
        }
        await dependencies.claims.markSent(
          claimKey,
          dependencies.now().toISOString(),
        );
        return result;
      } catch (error) {
        await dependencies.claims.markFailed(
          claimKey,
          dependencies.now().toISOString(),
        );
        throw error;
      }
    };

    if (reminder.deliveryPlan.mode === "email") {
      await sendEmail();
    } else if (reminder.deliveryPlan.mode === "web_push") {
      await sendPush();
    } else {
      try {
        const pushResult = await sendPush();
        if (pushResult === "gone") await sendEmail();
      } catch {
        await sendEmail();
      }
    }
    let externalRetryRequired = false;
    const destinationTargets = reminder.deliveryPlan.targets.filter(
      (target) => target.channel === "destination",
    );
    if (
      destinationTargets.length > 0 &&
      (dependencies.destinations === undefined ||
        dependencies.attempts === undefined ||
        dependencies.slackDelivery === undefined ||
        dependencies.webhookDelivery === undefined)
    ) {
      throw new Error("EXTERNAL_DELIVERY_NOT_CONFIGURED");
    }
    const destinations = dependencies.destinations;
    const attempts = dependencies.attempts;
    const slackDelivery = dependencies.slackDelivery;
    const webhookDelivery = dependencies.webhookDelivery;
    for (const target of destinationTargets) {
      const attemptKey = `${message.idempotencyKey}:destination:${target.destinationId}`;
      if (
        destinations === undefined ||
        attempts === undefined ||
        slackDelivery === undefined ||
        webhookDelivery === undefined
      ) {
        throw new Error("EXTERNAL_DELIVERY_NOT_CONFIGURED");
      }
      const destination = await destinations.findById(target.destinationId);
      if (
        destination === null ||
        destination.ownerUserId !== reminder.ownerUserId ||
        destination.status === "disabled"
      ) {
        await attempts.record({
          idempotencyKey: attemptKey,
          reminderId: reminder.id,
          destinationId: target.destinationId,
          eventType: "reminder.due",
          status: "skipped",
          failureCode: "DESTINATION_UNAVAILABLE",
          occurredAt: dependencies.now().toISOString(),
        });
        continue;
      }
      const claimed = await dependencies.claims.claim(
        attemptKey,
        reminder.id,
        dependencies.now().toISOString(),
      );
      if (!claimed) continue;
      const occurredAt = dependencies.now().toISOString();
      const event: ExternalDeliveryEvent = {
        schemaVersion: 1,
        event: "reminder.due",
        idempotencyKey: attemptKey,
        occurredAt,
        reminder: {
          title: content.title,
          dueAt: reminder.schedule.resolvedUtc,
          manageUrl,
        },
      };
      try {
        await attempts.record({
          idempotencyKey: attemptKey,
          reminderId: reminder.id,
          destinationId: destination.id,
          eventType: "reminder.due",
          status: "processing",
          occurredAt,
        });
        if (destination.credential.kind === "slack") {
          await slackDelivery.send(destination.credential, event);
        } else {
          await webhookDelivery.send(destination.credential, event);
        }
        await Promise.all([
          dependencies.claims.markSent(attemptKey, occurredAt),
          destinations.markSucceeded(destination.id, occurredAt),
          attempts.record({
            idempotencyKey: attemptKey,
            reminderId: reminder.id,
            destinationId: destination.id,
            eventType: "reminder.due",
            status: "sent",
            occurredAt,
          }),
        ]);
      } catch (error) {
        const externalError =
          error instanceof ExternalDeliveryError
            ? error
            : new ExternalDeliveryError("EXTERNAL_DELIVERY_FAILED", true);
        await Promise.all([
          externalError.retryable
            ? dependencies.claims.markFailed(attemptKey, occurredAt)
            : dependencies.claims.markSent(attemptKey, occurredAt),
          destinations.markFailed(destination.id, occurredAt),
          attempts.record({
            idempotencyKey: attemptKey,
            reminderId: reminder.id,
            destinationId: destination.id,
            eventType: "reminder.due",
            status: "failed",
            failureCode: externalError.code,
            occurredAt,
          }),
        ]);
        externalRetryRequired ||= externalError.retryable;
      }
    }
    if (externalRetryRequired)
      throw new Error("EXTERNAL_DELIVERY_RETRY_REQUIRED");
    dependencies.logger.info({
      operation: "delivery",
      outcome: "sent",
      traceId: message.traceId,
      reminderId: reminder.id,
    });
    incoming.ack();
  } catch {
    dependencies.logger.error({
      operation: "delivery",
      outcome: "retry",
      code: "DELIVERY_FAILED",
      traceId: message.traceId,
      reminderId: reminder.id,
    });
    incoming.retry();
  }
}
