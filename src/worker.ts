import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { createRequestHandler, RouterContextProvider } from "react-router";
import * as build from "virtual:react-router/server-build";

import { createReminder } from "./application/use-cases/create-reminder";
import { reviewReminder } from "./application/use-cases/review-reminder";
import { verifyReminder } from "./application/use-cases/verify-reminder";
import { getReminderView } from "./application/use-cases/get-reminder-view";
import { manageReminder } from "./application/use-cases/manage-reminder/manage-reminder";
import { unsubscribe } from "./application/use-cases/unsubscribe";
import { WebCryptoContentProtector } from "./infrastructure/cloudflare/crypto/content-protector";
import { FlUserAuthClient } from "./infrastructure/cloudflare/auth/fl-user-auth-client";
import { D1ReminderRepository } from "./infrastructure/cloudflare/d1/reminder-repository";
import { D1SuppressionRepository } from "./infrastructure/cloudflare/d1/suppression-repository";
import { D1DeliveryClaimRepository } from "./infrastructure/cloudflare/d1/delivery-claim-repository";
import { D1PushSubscriptionRepository } from "./infrastructure/cloudflare/d1/push-subscription-repository";
import { CloudflareEmailServiceAdapter } from "./infrastructure/cloudflare/email/email-service-adapter";
import { RedactedLogger } from "./infrastructure/cloudflare/observability/redacted-logger";
import { processDeliveryMessage } from "./infrastructure/cloudflare/queues/process-delivery-message";
import { CloudflareWebPushAdapter } from "./infrastructure/cloudflare/web-push/web-push-adapter";
import { reminderWorkflowMessageSchema } from "./infrastructure/cloudflare/workflows/reminder-workflow-message";
import type { ReminderWorkflowMessage } from "./infrastructure/cloudflare/workflows/reminder-workflow-message";
import { CloudflareWorkflowScheduler } from "./infrastructure/cloudflare/workflows/cloudflare-workflow-scheduler";
import type { CloudflareEnv } from "./infrastructure/cloudflare/env";
import { D1TokenPort } from "./infrastructure/cloudflare/tokens/d1-token-port";
import {
  CloudflareTurnstileAdapter,
  LocalTurnstileAdapter,
} from "./infrastructure/cloudflare/turnstile/verify-turnstile";
import { applicationServicesContext } from "./presentation/server-context";

const handleRequest = createRequestHandler(build, import.meta.env.MODE);

export class ReminderWorkflow extends WorkflowEntrypoint<
  CloudflareEnv,
  ReminderWorkflowMessage
> {
  override async run(
    event: Readonly<WorkflowEvent<ReminderWorkflowMessage>>,
    step: WorkflowStep,
  ): Promise<void> {
    const payload = reminderWorkflowMessageSchema.parse(event.payload);
    await step.sleepUntil("wait-until-reminder", new Date(payload.dueAt));
    await step.do("reload-and-enqueue-current-state", async () => {
      const reminder = await new D1ReminderRepository(this.env.DB).findById(
        payload.reminderId,
      );
      if (reminder === null) return { enqueued: false };
      if (
        reminder.version !== payload.expectedVersion ||
        (reminder.status !== "active" && reminder.status !== "snoozed")
      )
        return { enqueued: false };
      await this.env.REMINDER_QUEUE.send({
        schemaVersion: 1,
        kind: "reminder_delivery",
        reminderId: reminder.id,
        expectedVersion: reminder.version,
        idempotencyKey: payload.idempotencyKey,
        traceId: payload.traceId,
      });
      return { enqueued: true };
    });
  }
}

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    const requestId = crypto.randomUUID();
    const requestOrigin = new URL(request.url).origin;
    const clock = { now: () => new Date() };
    const reminders = new D1ReminderRepository(env.DB);
    const tokens = new D1TokenPort(env.DB);
    const suppressions = new D1SuppressionRepository(env.DB);
    const pushSubscriptions = new D1PushSubscriptionRepository(
      env.DB,
      env.CONTENT_ENCRYPTION_KEY,
    );
    const turnstile =
      env.TURNSTILE_SECRET_KEY === undefined
        ? new LocalTurnstileAdapter(requestOrigin)
        : new CloudflareTurnstileAdapter(
            env.TURNSTILE_SECRET_KEY,
            new URL(requestOrigin).hostname,
          );
    const contentProtector = new WebCryptoContentProtector(
      env.CONTENT_ENCRYPTION_KEY,
    );
    const auth = new FlUserAuthClient({
      baseUrl: env.AUTH_BASE_URL,
      relyingWebsiteId: env.AUTH_RELYING_WEBSITE_ID,
      fetcher: (input, init) =>
        env.AUTH_SERVICE.fetch(new Request(input, init)),
    });
    const authCallbackUrl = new URL("/auth/callback", requestOrigin).toString();
    const dependencies = {
      clock,
      ids: { create: () => crypto.randomUUID() },
      turnstile,
      contentProtector,
      pendingStore: reminders,
      reminders,
      pushSubscriptions,
      scheduler: new CloudflareWorkflowScheduler(env.REMINDER_WORKFLOW),
      tokens,
    };

    const context = new RouterContextProvider();
    context.set(applicationServicesContext, {
      requestId,
      showLocalVerificationPreview:
        /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(requestOrigin),
      turnstileSiteKey: env.TURNSTILE_SITE_KEY,
      vapidPublicKey: env.VAPID_PUBLIC_KEY,
      auth,
      authCallbackUrl,
      secureAuthCookie: new URL(requestOrigin).protocol === "https:",
      reviewReminder,
      createReminder: (input) => createReminder(dependencies, input, requestId),
      verifyReminder: (token) =>
        verifyReminder(
          {
            clock,
            reminders,
            tokens,
            scheduler: new CloudflareWorkflowScheduler(env.REMINDER_WORKFLOW),
          },
          token,
          requestId,
        ),
      getReminderView: (token) =>
        getReminderView(
          { clock, reminders, tokens, contentProtector },
          token,
          requestId,
        ),
      manageReminder: (input) =>
        manageReminder(
          { clock, reminders, tokens, suppressions },
          input,
          requestId,
        ),
      unsubscribe: (token) =>
        unsubscribe(
          { clock, reminders, tokens, suppressions },
          token,
          requestId,
        ),
    });
    return handleRequest(request, context);
  },

  async queue(batch: MessageBatch, env: CloudflareEnv): Promise<void> {
    const reminders = new D1ReminderRepository(env.DB);
    const suppressions = new D1SuppressionRepository(env.DB);
    const protector = new WebCryptoContentProtector(env.CONTENT_ENCRYPTION_KEY);
    const tokens = new D1TokenPort(env.DB);
    const pushSubscriptions = new D1PushSubscriptionRepository(
      env.DB,
      env.CONTENT_ENCRYPTION_KEY,
    );
    const webPush =
      env.VAPID_PRIVATE_KEY === undefined
        ? {
            send: () => Promise.reject(new Error("VAPID_NOT_CONFIGURED")),
          }
        : new CloudflareWebPushAdapter({
            publicKey: env.VAPID_PUBLIC_KEY,
            privateKey: env.VAPID_PRIVATE_KEY,
            subject: env.VAPID_SUBJECT,
          });
    const dependencies = {
      reminders,
      suppressions,
      claims: new D1DeliveryClaimRepository(env.DB),
      protector,
      tokens,
      email: new CloudflareEmailServiceAdapter(env.EMAIL, env.EMAIL_FROM),
      pushSubscriptions,
      webPush,
      logger: new RedactedLogger(),
      origin: env.APP_ORIGIN,
      now: () => new Date(),
    };
    await Promise.all(
      batch.messages.map((message) =>
        processDeliveryMessage(dependencies, message),
      ),
    );
  },
} satisfies ExportedHandler<CloudflareEnv>;
