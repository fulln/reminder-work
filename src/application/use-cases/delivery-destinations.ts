import {
  failure,
  success,
  type ActionResult,
} from "../contracts/action-result";
import type { Clock } from "../ports/clock";
import type {
  DeliveryDestination,
  DeliveryDestinationRepository,
} from "../ports/delivery-destination-repository";
import type { DeliveryAttemptRepository } from "../ports/delivery-attempt-repository";
import {
  ExternalDeliveryError,
  type ExternalDeliveryEvent,
  type SlackDeliveryPort,
  type WebhookDeliveryPort,
} from "../ports/external-delivery";
import type { IdGenerator } from "../ports/id-generator";
import type {
  SlackOAuthPort,
  SlackOAuthStateRepository,
} from "../ports/slack-oauth";
import { normalizeOutboundWebhookUrl } from "../support/outbound-webhook-url";

const maximumDestinationsPerUser = 20;
const maximumTestsPerHour = 5;

export interface DeliveryDestinationView {
  readonly id: string;
  readonly type: "slack" | "webhook";
  readonly label: string;
  readonly detail: string;
  readonly status: "active" | "failing" | "disabled";
  readonly consecutiveFailures: number;
  readonly lastSuccessAt?: string;
  readonly lastFailureAt?: string;
}

export interface DeliveryDestinationDependencies {
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly destinations: DeliveryDestinationRepository;
  readonly attempts: DeliveryAttemptRepository;
  readonly slackDelivery: SlackDeliveryPort;
  readonly webhookDelivery: WebhookDeliveryPort;
  readonly origin: string;
}

function toView(destination: DeliveryDestination): DeliveryDestinationView {
  return {
    id: destination.id,
    type: destination.type,
    label: destination.label,
    detail:
      destination.credential.kind === "slack"
        ? `${destination.credential.workspaceName} · ${destination.credential.channelName}`
        : new URL(destination.credential.url).hostname,
    status: destination.status,
    consecutiveFailures: destination.consecutiveFailures,
    ...(destination.lastSuccessAt === undefined
      ? {}
      : { lastSuccessAt: destination.lastSuccessAt }),
    ...(destination.lastFailureAt === undefined
      ? {}
      : { lastFailureAt: destination.lastFailureAt }),
  };
}

export async function listDeliveryDestinations(
  dependencies: Pick<DeliveryDestinationDependencies, "destinations">,
  userId: string,
  requestId: string,
): Promise<ActionResult<{ readonly destinations: DeliveryDestinationView[] }>> {
  const destinations = await dependencies.destinations.findByOwner(userId);
  return success(requestId, { destinations: destinations.map(toView) });
}

export async function createWebhookDestination(
  dependencies: Pick<
    DeliveryDestinationDependencies,
    "clock" | "ids" | "destinations"
  >,
  userId: string,
  input: {
    readonly label: string;
    readonly url: string;
    readonly signingSecret: string;
  },
  requestId: string,
): Promise<ActionResult<{ readonly destination: DeliveryDestinationView }>> {
  const label = input.label.trim();
  const url = normalizeOutboundWebhookUrl(input.url);
  const signingSecret = input.signingSecret.trim();
  const fields: Record<string, readonly string[]> = {};
  if (label.length < 1 || label.length > 80) {
    fields.label = ["Enter a label between 1 and 80 characters."];
  }
  if (url === null) {
    fields.url = [
      "Enter a public HTTPS webhook URL without credentials or a custom port.",
    ];
  }
  if (signingSecret.length < 16 || signingSecret.length > 200) {
    fields.signingSecret = [
      "Use a signing secret between 16 and 200 characters.",
    ];
  }
  if (Object.keys(fields).length > 0 || url === null) {
    return failure(requestId, {
      code: "WEBHOOK_INPUT_INVALID",
      retryable: false,
      fields,
      form: "Review the webhook details.",
    });
  }
  if (
    (await dependencies.destinations.findByOwner(userId)).length >=
    maximumDestinationsPerUser
  ) {
    return failure(requestId, {
      code: "DESTINATION_LIMIT_REACHED",
      retryable: false,
      form: `Each account can save up to ${String(maximumDestinationsPerUser)} external destinations.`,
    });
  }
  const now = dependencies.clock.now().toISOString();
  const destination = await dependencies.destinations.create({
    id: dependencies.ids.create(),
    ownerUserId: userId,
    label,
    credential: { kind: "webhook", url, signingSecret },
    createdAt: now,
  });
  return success(requestId, { destination: toView(destination) });
}

export async function setDeliveryDestinationEnabled(
  dependencies: Pick<DeliveryDestinationDependencies, "clock" | "destinations">,
  userId: string,
  destinationId: string,
  enabled: boolean,
  requestId: string,
): Promise<ActionResult<{ readonly enabled: boolean }>> {
  const updated = await dependencies.destinations.setEnabled(
    userId,
    destinationId,
    enabled,
    dependencies.clock.now().toISOString(),
  );
  return updated
    ? success(requestId, { enabled })
    : destinationUnavailable(requestId);
}

export async function deleteDeliveryDestination(
  dependencies: Pick<DeliveryDestinationDependencies, "destinations"> & {
    readonly slackOAuth: SlackOAuthPort;
  },
  userId: string,
  destinationId: string,
  requestId: string,
): Promise<ActionResult<{ readonly deleted: true }>> {
  const destination = await dependencies.destinations.findById(destinationId);
  if (destination?.ownerUserId !== userId)
    return destinationUnavailable(requestId);
  if (
    destination.credential.kind === "slack" &&
    destination.credential.accessToken !== undefined
  ) {
    await dependencies.slackOAuth
      .revoke(destination.credential.accessToken)
      .catch(() => undefined);
  }
  const deleted = await dependencies.destinations.delete(userId, destinationId);
  return deleted
    ? success(requestId, { deleted: true })
    : destinationUnavailable(requestId);
}

export async function testDeliveryDestination(
  dependencies: DeliveryDestinationDependencies,
  userId: string,
  destinationId: string,
  requestId: string,
): Promise<ActionResult<{ readonly sent: true }>> {
  const destination = await dependencies.destinations.findById(destinationId);
  if (
    destination?.ownerUserId !== userId ||
    destination.status === "disabled"
  ) {
    return destinationUnavailable(requestId);
  }
  const now = dependencies.clock.now();
  const occurredAt = now.toISOString();
  const testWindowStart = new Date(
    now.getTime() - 60 * 60 * 1000,
  ).toISOString();
  if (
    (await dependencies.attempts.countRecentTests(
      destination.id,
      testWindowStart,
    )) >= maximumTestsPerHour
  ) {
    return failure(requestId, {
      code: "DESTINATION_TEST_RATE_LIMITED",
      retryable: true,
      form: "Test delivery limit reached. Try again later.",
    });
  }
  const idempotencyKey = `test:${destination.id}:${dependencies.ids.create()}`;
  const event: ExternalDeliveryEvent = {
    schemaVersion: 1,
    event: "delivery.test",
    idempotencyKey,
    occurredAt,
    reminder: {
      title: "Test reminder from Reminders.work",
      dueAt: occurredAt,
      manageUrl: dependencies.origin,
    },
  };
  await dependencies.attempts.record({
    idempotencyKey,
    destinationId,
    eventType: "delivery.test",
    status: "processing",
    occurredAt,
  });
  try {
    if (destination.credential.kind === "slack") {
      await dependencies.slackDelivery.send(destination.credential, event);
    } else {
      await dependencies.webhookDelivery.send(destination.credential, event);
    }
    await Promise.all([
      dependencies.destinations.markSucceeded(destination.id, occurredAt),
      dependencies.attempts.record({
        idempotencyKey,
        destinationId,
        eventType: "delivery.test",
        status: "sent",
        occurredAt,
      }),
    ]);
    return success(requestId, { sent: true });
  } catch (error) {
    const code =
      error instanceof ExternalDeliveryError
        ? error.code
        : "DESTINATION_TEST_FAILED";
    await Promise.all([
      dependencies.destinations.markFailed(destination.id, occurredAt),
      dependencies.attempts.record({
        idempotencyKey,
        destinationId,
        eventType: "delivery.test",
        status: "failed",
        failureCode: code,
        occurredAt,
      }),
    ]);
    return failure(requestId, {
      code,
      retryable: error instanceof ExternalDeliveryError && error.retryable,
      form: "The test delivery failed. Check the destination and try again.",
    });
  }
}

export async function beginSlackConnection(
  dependencies: {
    readonly clock: Clock;
    readonly states: SlackOAuthStateRepository;
    readonly slackOAuth: SlackOAuthPort;
    readonly redirectUri: string;
  },
  userId: string,
  requestId: string,
): Promise<ActionResult<{ readonly authorizationUrl: string }>> {
  if (!dependencies.slackOAuth.available) {
    return failure(requestId, {
      code: "SLACK_NOT_CONFIGURED",
      retryable: false,
      form: "Slack connections are not configured for this deployment yet.",
    });
  }
  const state = await dependencies.states.issue(
    userId,
    dependencies.clock.now(),
  );
  return success(requestId, {
    authorizationUrl: dependencies.slackOAuth.authorizationUrl({
      state,
      redirectUri: dependencies.redirectUri,
    }),
  });
}

export async function finishSlackConnection(
  dependencies: {
    readonly clock: Clock;
    readonly ids: IdGenerator;
    readonly states: SlackOAuthStateRepository;
    readonly slackOAuth: SlackOAuthPort;
    readonly destinations: DeliveryDestinationRepository;
    readonly redirectUri: string;
  },
  userId: string,
  input: { readonly state: string; readonly code: string },
  requestId: string,
): Promise<ActionResult<{ readonly destination: DeliveryDestinationView }>> {
  const validState = await dependencies.states.consume(
    input.state,
    userId,
    dependencies.clock.now(),
  );
  if (!validState) {
    return failure(requestId, {
      code: "SLACK_OAUTH_STATE_INVALID",
      retryable: false,
      form: "The Slack connection request expired. Start again.",
    });
  }
  let credential;
  try {
    credential = await dependencies.slackOAuth.exchangeCode({
      code: input.code,
      redirectUri: dependencies.redirectUri,
    });
  } catch (error) {
    console.warn("[slack-oauth] exchange_failed", {
      reason:
        error instanceof Error && "reason" in error
          ? String(error.reason)
          : error instanceof Error
            ? `${error.name}:${error.message}`
            : "unknown",
      requestId,
    });
    return failure(requestId, {
      code: "SLACK_OAUTH_EXCHANGE_FAILED",
      retryable: true,
      form: "Slack could not be connected. Start the connection again.",
    });
  }
  const existing = await dependencies.destinations.findSlackChannel(
    userId,
    credential.workspaceId,
    credential.channelId,
  );
  if (
    existing === null &&
    (await dependencies.destinations.findByOwner(userId)).length >=
      maximumDestinationsPerUser
  ) {
    return failure(requestId, {
      code: "DESTINATION_LIMIT_REACHED",
      retryable: false,
      form: `Each account can save up to ${String(maximumDestinationsPerUser)} external destinations.`,
    });
  }
  const updatedAt = dependencies.clock.now().toISOString();
  const label = `Slack · ${credential.channelName}`;
  const destination =
    existing === null
      ? await dependencies.destinations.create({
          id: dependencies.ids.create(),
          ownerUserId: userId,
          label,
          credential,
          createdAt: updatedAt,
        })
      : await dependencies.destinations.replaceCredential({
          ownerUserId: userId,
          id: existing.id,
          label,
          credential,
          updatedAt,
        });
  if (destination === null) return destinationUnavailable(requestId);
  return success(requestId, { destination: toView(destination) });
}

function destinationUnavailable(requestId: string): ActionResult<never> {
  return failure(requestId, {
    code: "DESTINATION_UNAVAILABLE",
    retryable: false,
    form: "This delivery destination is unavailable.",
  });
}
