import type { SuppressionRepository } from "../../../application/ports/suppression-repository";
import { normalizeEmailAddress } from "../../../application/support/email-address";
import { keyedDigest, stableDigest } from "../crypto/encrypted-json";
import type { SafeLogger } from "../observability/redacted-logger";
import {
  emailSendingSuppressionEventSchema,
  type EmailSendingSuppressionEvent,
} from "./email-sending-event";

export interface EmailSendingEventMessageLike {
  readonly body: unknown;
  ack(): void;
  retry(): void;
}

export interface ProcessEmailSendingEventDependencies {
  readonly suppressions: SuppressionRepository;
  readonly logger: SafeLogger;
  readonly keyMaterial: string;
  readonly sendingDomain: string;
}

export async function processEmailSendingEvent(
  dependencies: ProcessEmailSendingEventDependencies,
  incoming: EmailSendingEventMessageLike,
): Promise<void> {
  const parsed = emailSendingSuppressionEventSchema.safeParse(incoming.body);
  if (!parsed.success) {
    dependencies.logger.error({
      operation: "email-event",
      outcome: "invalid-message",
      code: "EMAIL_EVENT_SCHEMA_INVALID",
    });
    incoming.ack();
    return;
  }

  const event = parsed.data;
  if (
    event.source.domain.toLowerCase() !==
    dependencies.sendingDomain.toLowerCase()
  ) {
    dependencies.logger.info({
      operation: "email-event",
      outcome: "ignored-domain",
      eventId: event.payload.eventId,
    });
    incoming.ack();
    return;
  }

  const suppressionReason = suppressionReasonFor(event);
  if (suppressionReason === null) {
    dependencies.logger.info({
      operation: "email-event",
      outcome: "ignored-soft-bounce",
      eventId: event.payload.eventId,
    });
    incoming.ack();
    return;
  }

  const recipient = normalizeEmailAddress(event.payload.recipient);
  if (recipient === null) {
    dependencies.logger.error({
      operation: "email-event",
      outcome: "invalid-recipient",
      code: "EMAIL_EVENT_RECIPIENT_INVALID",
      eventId: event.payload.eventId,
    });
    incoming.ack();
    return;
  }

  try {
    const recipientRefs = await Promise.all([
      keyedDigest(recipient, dependencies.keyMaterial),
      stableDigest(recipient),
    ]);
    await Promise.all(
      recipientRefs.map((recipientRef) =>
        dependencies.suppressions.suppress(
          recipientRef,
          event.metadata.eventTimestamp,
        ),
      ),
    );
    dependencies.logger.info({
      operation: "email-event",
      outcome: suppressionReason,
      eventId: event.payload.eventId,
    });
    incoming.ack();
  } catch {
    dependencies.logger.error({
      operation: "email-event",
      outcome: "retry",
      code: "EMAIL_EVENT_SUPPRESSION_FAILED",
      eventId: event.payload.eventId,
    });
    incoming.retry();
  }
}

function suppressionReasonFor(
  event: EmailSendingSuppressionEvent,
): "hard-bounce" | "complaint" | null {
  if (event.type === "cf.email.sending.message.complained") {
    return "complaint";
  }
  return event.payload.bounce?.type === "hard" ? "hard-bounce" : null;
}
