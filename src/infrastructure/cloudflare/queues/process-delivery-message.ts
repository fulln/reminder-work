import type { ContentProtector } from "../../../application/ports/content-protector";
import type { ReminderRepository } from "../../../application/ports/reminder-repository";
import type { SuppressionRepository } from "../../../application/ports/suppression-repository";
import type { TokenPort } from "../../../application/ports/token";
import type { DeliveryClaimRepository } from "../d1/delivery-claim-repository";
import type { ReminderEmailPort } from "../email/email-service-adapter";
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
  const suppressed = await dependencies.suppressions.isSuppressed(
    reminder.recipientRef,
  );
  const decision = deliveryDecision(
    reminder,
    message.expectedVersion,
    suppressed,
  );
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
  const now = dependencies.now();
  const claimed = await dependencies.claims.claim(
    message.idempotencyKey,
    reminder.id,
    now.toISOString(),
  );
  if (!claimed) {
    dependencies.logger.info({
      operation: "delivery",
      outcome: "duplicate",
      traceId: message.traceId,
      reminderId: reminder.id,
    });
    incoming.ack();
    return;
  }

  try {
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
    await dependencies.email.sendReminder({
      to: content.recipientEmail,
      title: content.title,
      dueAt: reminder.schedule.resolvedUtc,
      manageUrl: `${dependencies.origin}/manage/${manageToken}`,
      unsubscribeUrl: `${dependencies.origin}/unsubscribe/${unsubscribeToken}`,
    });
    await dependencies.claims.markSent(
      message.idempotencyKey,
      dependencies.now().toISOString(),
    );
    dependencies.logger.info({
      operation: "delivery",
      outcome: "sent",
      traceId: message.traceId,
      reminderId: reminder.id,
    });
    incoming.ack();
  } catch {
    await dependencies.claims.markFailed(
      message.idempotencyKey,
      dependencies.now().toISOString(),
    );
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
