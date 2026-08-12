import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { createRequestHandler, RouterContextProvider } from "react-router";
import * as build from "virtual:react-router/server-build";

import type { ActionResult } from "./application/contracts/action-result";
import { createReminder } from "./application/use-cases/create-reminder";
import { reviewReminder } from "./application/use-cases/review-reminder";
import { verifyReminder } from "./application/use-cases/verify-reminder";
import { getCalendarFeed } from "./application/use-cases/get-calendar-feed";
import { getReminderView } from "./application/use-cases/get-reminder-view";
import { manageReminder } from "./application/use-cases/manage-reminder/manage-reminder";
import { unsubscribe } from "./application/use-cases/unsubscribe";
import {
  getOwnedReminderView,
  listOwnedReminders,
  manageOwnedReminder,
} from "./application/use-cases/owned-reminders";
import {
  forgetSavedEmailRecipient,
  getEmailSettings,
  verifyEmailIdentity,
} from "./application/use-cases/email-settings";
import { WebCryptoContentProtector } from "./infrastructure/cloudflare/crypto/content-protector";
import { FlUserAuthClient } from "./infrastructure/cloudflare/auth/fl-user-auth-client";
import { D1ReminderRepository } from "./infrastructure/cloudflare/d1/reminder-repository";
import { D1CalendarFeedStore } from "./infrastructure/cloudflare/d1/calendar-feed-store";
import { D1SuppressionRepository } from "./infrastructure/cloudflare/d1/suppression-repository";
import { D1DeliveryClaimRepository } from "./infrastructure/cloudflare/d1/delivery-claim-repository";
import { D1PushSubscriptionRepository } from "./infrastructure/cloudflare/d1/push-subscription-repository";
import { D1EmailIdentityRepository } from "./infrastructure/cloudflare/d1/email-identity-repository";
import { D1EmailIdentityVerificationTokenRepository } from "./infrastructure/cloudflare/d1/email-identity-verification-token-repository";
import { D1EmailReminderCreationLimiter } from "./infrastructure/cloudflare/d1/email-reminder-creation-limiter";
import { keyedDigest } from "./infrastructure/cloudflare/crypto/encrypted-json";
import { CloudflareEmailServiceAdapter } from "./infrastructure/cloudflare/email/email-service-adapter";
import { RedactedLogger } from "./infrastructure/cloudflare/observability/redacted-logger";
import { processDeliveryMessage } from "./infrastructure/cloudflare/queues/process-delivery-message";
import { EMAIL_SENDING_EVENTS_QUEUE } from "./infrastructure/cloudflare/queues/email-sending-event";
import { processEmailSendingEvent } from "./infrastructure/cloudflare/queues/process-email-sending-event";
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

function emailSettingsMessage<T>(
  result: ActionResult<T>,
  message: string | ((data: T) => string),
): ActionResult<{ readonly message: string }> {
  return result.ok
    ? {
        ok: true,
        requestId: result.requestId,
        data: {
          message:
            typeof message === "function" ? message(result.data) : message,
        },
      }
    : result;
}

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
    const calendarFeeds = new D1CalendarFeedStore(env.DB);
    const emailIdentities = new D1EmailIdentityRepository(
      env.DB,
      env.CONTENT_ENCRYPTION_KEY,
    );
    const emailIdentityTokens = new D1EmailIdentityVerificationTokenRepository(
      env.DB,
    );
    const localRequest = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(
      requestOrigin,
    );
    const emailCreationLimiter = localRequest
      ? { reserve: () => Promise.resolve(true) }
      : new D1EmailReminderCreationLimiter(env.DB);
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
    const authLoginUrl = new URL("/auth/login", env.AUTH_BASE_URL);
    authLoginUrl.searchParams.set("site", env.AUTH_RELYING_WEBSITE_ID);
    authLoginUrl.searchParams.set("return_to", authCallbackUrl);
    const dependencies = {
      clock,
      ids: { create: () => crypto.randomUUID() },
      turnstile,
      contentProtector,
      reminders,
      suppressions,
      emailCreationLimiter,
      pushSubscriptions,
      scheduler: new CloudflareWorkflowScheduler(env.REMINDER_WORKFLOW),
      tokens,
      emailIdentities,
    };

    const context = new RouterContextProvider();
    context.set(applicationServicesContext, {
      requestId,
      showLocalVerificationPreview: localRequest,
      turnstileSiteKey: env.TURNSTILE_SITE_KEY,
      vapidPublicKey: env.VAPID_PUBLIC_KEY,
      auth,
      authCallbackUrl,
      authLoginUrl: authLoginUrl.toString(),
      secureAuthCookie: new URL(requestOrigin).protocol === "https:",
      reviewReminder,
      createReminder: async (input, ownerUserId) =>
        createReminder(dependencies, input, requestId, {
          ownerUserId,
          actorRef: await keyedDigest(
            ownerUserId === undefined
              ? `ip:${request.headers.get("CF-Connecting-IP") ?? "local"}`
              : `user:${ownerUserId}`,
            env.CONTENT_ENCRYPTION_KEY,
          ),
        }),
      verifyReminder: (token) =>
        verifyReminder(
          {
            clock,
            reminders,
            tokens,
            scheduler: new CloudflareWorkflowScheduler(env.REMINDER_WORKFLOW),
            calendarFeeds,
            emailIdentities,
            appOrigin: requestOrigin,
          },
          token,
          requestId,
        ),
      getCalendarFeed: (token) =>
        getCalendarFeed(
          {
            feeds: calendarFeeds,
            contentProtector,
            now: () => new Date(),
          },
          token,
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
      listOwnedReminders: (userId) =>
        listOwnedReminders({ reminders, contentProtector }, userId, requestId),
      getOwnedReminderView: (userId, reminderId) =>
        getOwnedReminderView(
          { reminders, contentProtector },
          userId,
          reminderId,
          requestId,
        ),
      manageOwnedReminder: (userId, input) =>
        manageOwnedReminder(
          { clock, reminders },
          userId,
          input.reminderId,
          input,
          requestId,
        ),
      getEmailSettings: async (userId) => {
        const result = await getEmailSettings(
          { emailIdentities },
          userId,
          requestId,
        );
        return result.ok
          ? {
              ok: true as const,
              requestId: result.requestId,
              data: {
                identities: result.data.identities.map((identity) => ({
                  id: identity.id,
                  email: identity.fullEmail,
                  status: identity.state,
                  activeReminderCount: identity.activeReminderCount,
                  lastUsedAtLabel: new Date(
                    identity.lastUsedAt,
                  ).toLocaleDateString("en", {
                    dateStyle: "medium",
                    timeZone: "UTC",
                  }),
                })),
              },
            }
          : result;
      },
      forgetSavedEmailRecipient: async (userId, identityId) =>
        emailSettingsMessage(
          await forgetSavedEmailRecipient(
            { emailIdentities },
            userId,
            identityId,
            requestId,
          ),
          "Saved address removed. Existing reminders are unchanged.",
        ),
      verifyEmailIdentity: async (token) =>
        emailSettingsMessage(
          await verifyEmailIdentity(
            { clock, emailIdentities, verificationTokens: emailIdentityTokens },
            token,
            requestId,
          ),
          "Email verified.",
        ),
    });
    return handleRequest(request, context);
  },

  async queue(batch: MessageBatch, env: CloudflareEnv): Promise<void> {
    const suppressions = new D1SuppressionRepository(env.DB);
    const logger = new RedactedLogger();
    if (batch.queue === EMAIL_SENDING_EVENTS_QUEUE) {
      const sendingDomain = env.EMAIL_FROM.slice(
        env.EMAIL_FROM.lastIndexOf("@") + 1,
      );
      await Promise.all(
        batch.messages.map((message) =>
          processEmailSendingEvent(
            {
              suppressions,
              logger,
              keyMaterial: env.CONTENT_ENCRYPTION_KEY,
              sendingDomain,
            },
            message,
          ),
        ),
      );
      return;
    }

    const reminders = new D1ReminderRepository(env.DB);
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
      logger,
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
