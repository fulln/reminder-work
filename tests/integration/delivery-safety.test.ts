import { describe, expect, it, vi } from "vitest";

import { deliveryDecision } from "../../src/infrastructure/cloudflare/queues/delivery-safety";
import { processDeliveryMessage } from "../../src/infrastructure/cloudflare/queues/process-delivery-message";
import { RedactedLogger } from "../../src/infrastructure/cloudflare/observability/redacted-logger";
import type { Reminder } from "../../src/domain/reminder/reminder";

const reminder: Reminder = {
  id: "reminder-1",
  version: 3,
  status: "active",
  schedule: {
    kind: "once",
    anchorLocal: "2026-08-11T09:00",
    timeZone: "Asia/Shanghai",
    resolvedUtc: "2026-08-11T01:00:00.000Z",
    recurrence: null,
    leadOffsetsMinutes: [],
  },
  deliveryPlan: { mode: "email", targets: [{ channel: "email" }] },
  recipientRef: "recipient-ref",
  contentCiphertext: "ciphertext",
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
};

describe("delivery safety", () => {
  it("gives terminal and suppression state precedence over queued work", () => {
    expect(
      deliveryDecision({ ...reminder, status: "completed" }, 3, false),
    ).toBe("skip-terminal");
    expect(deliveryDecision(reminder, 3, true)).toBe("skip-suppressed");
    expect(deliveryDecision(reminder, 2, false)).toBe("skip-version");
  });

  it("marks failed attempts retryable and sends once after retry", async () => {
    let failed = false;
    let sent = false;
    const email = {
      sendReminder: vi
        .fn()
        .mockRejectedValueOnce(new Error("temporary"))
        .mockResolvedValueOnce(undefined),
    };
    const dependencies = {
      reminders: {
        create: () => Promise.resolve(),
        findById: () => Promise.resolve(reminder),
        save: () => Promise.resolve(true),
      },
      suppressions: {
        suppress: () => Promise.resolve(),
        isSuppressed: () => Promise.resolve(false),
      },
      claims: {
        claim: () => Promise.resolve(!sent),
        markFailed: () => {
          failed = true;
          return Promise.resolve();
        },
        markSent: () => {
          sent = true;
          return Promise.resolve();
        },
      },
      protector: {
        protect: () =>
          Promise.resolve({ recipientRef: "ref", ciphertext: "cipher" }),
        unprotect: () =>
          Promise.resolve({
            title: "Private title",
            recipientEmail: "private@example.com",
          }),
      },
      tokens: {
        issue: vi.fn().mockResolvedValue("opaque-token"),
        resolve: () => Promise.resolve(null),
        consume: () => Promise.resolve(null),
      },
      email,
      pushSubscriptions: {
        upsert: vi.fn(),
        findActiveById: vi.fn().mockResolvedValue(null),
        revoke: vi.fn(),
      },
      webPush: { send: vi.fn() },
      logger: { info: vi.fn(), error: vi.fn() },
      origin: "https://reminders.work",
      now: () => new Date("2026-08-10T00:00:00.000Z"),
    };
    const message = () => ({
      body: {
        schemaVersion: 1,
        kind: "reminder_delivery",
        reminderId: "reminder-1",
        expectedVersion: 3,
        idempotencyKey: "occurrence-1",
        traceId: "trace-1",
      },
      ack: vi.fn(),
      retry: vi.fn(),
    });
    const first = message();
    await processDeliveryMessage(dependencies, first);
    expect(failed).toBe(true);
    expect(first.retry).toHaveBeenCalledOnce();
    const second = message();
    await processDeliveryMessage(dependencies, second);
    expect(sent).toBe(true);
    expect(second.ack).toHaveBeenCalledOnce();
    expect(email.sendReminder).toHaveBeenCalledTimes(2);
  });

  it("redacts content, email addresses, and tokens from structured logs", () => {
    const output: string[] = [];
    const logger = new RedactedLogger((line) => output.push(line));
    logger.info({
      operation: "deliver",
      reminderId: "reminder-1",
      outcome: "sent",
      email: "private@example.com",
      token: "opaque-secret",
      title: "Private title",
    });
    expect(output[0]).toContain('"operation":"deliver"');
    expect(output[0]).not.toContain("private@example.com");
    expect(output[0]).not.toContain("opaque-secret");
    expect(output[0]).not.toContain("Private title");
  });

  it("delivers push-only reminders without decrypting an email recipient", async () => {
    const pushReminder: Reminder = {
      ...reminder,
      deliveryPlan: {
        mode: "web_push",
        targets: [{ channel: "web_push", subscriptionId: "push-1" }],
      },
    };
    const email = { sendReminder: vi.fn() };
    const webPush = { send: vi.fn().mockResolvedValue("sent") };
    const incoming = {
      body: {
        schemaVersion: 1,
        kind: "reminder_delivery",
        reminderId: reminder.id,
        expectedVersion: reminder.version,
        idempotencyKey: "occurrence-push",
        traceId: "trace-push",
      },
      ack: vi.fn(),
      retry: vi.fn(),
    };

    await processDeliveryMessage(
      {
        reminders: {
          create: vi.fn(),
          findById: vi.fn().mockResolvedValue(pushReminder),
          save: vi.fn(),
        },
        suppressions: {
          suppress: vi.fn(),
          isSuppressed: vi.fn().mockResolvedValue(false),
        },
        claims: {
          claim: vi.fn().mockResolvedValue(true),
          markSent: vi.fn(),
          markFailed: vi.fn(),
        },
        protector: {
          protect: vi.fn(),
          unprotect: vi.fn().mockResolvedValue({ title: "Private title" }),
        },
        tokens: {
          issue: vi.fn().mockResolvedValue("opaque-token"),
          resolve: vi.fn(),
          consume: vi.fn(),
        },
        email,
        pushSubscriptions: {
          upsert: vi.fn(),
          findActiveById: vi.fn().mockResolvedValue({
            id: "push-1",
            endpoint: "https://push.example.com/1",
            keys: { p256dh: "A".repeat(87), auth: "B".repeat(22) },
          }),
          revoke: vi.fn(),
        },
        webPush,
        logger: { info: vi.fn(), error: vi.fn() },
        origin: "https://reminders.work",
        now: () => new Date("2026-08-10T00:00:00.000Z"),
      },
      incoming,
    );

    expect(webPush.send).toHaveBeenCalledOnce();
    expect(email.sendReminder).not.toHaveBeenCalled();
    expect(incoming.ack).toHaveBeenCalledOnce();
    expect(incoming.retry).not.toHaveBeenCalled();
  });

  it("revokes a gone subscription and falls back to verified email", async () => {
    const fallbackReminder: Reminder = {
      ...reminder,
      deliveryPlan: {
        mode: "web_push_email_fallback",
        targets: [
          { channel: "web_push", subscriptionId: "push-1" },
          { channel: "email" },
        ],
      },
    };
    const email = { sendReminder: vi.fn().mockResolvedValue(undefined) };
    const revoke = vi.fn();
    const incoming = {
      body: {
        schemaVersion: 1,
        kind: "reminder_delivery",
        reminderId: reminder.id,
        expectedVersion: reminder.version,
        idempotencyKey: "occurrence-fallback",
        traceId: "trace-fallback",
      },
      ack: vi.fn(),
      retry: vi.fn(),
    };

    await processDeliveryMessage(
      {
        reminders: {
          create: vi.fn(),
          findById: vi.fn().mockResolvedValue(fallbackReminder),
          save: vi.fn(),
        },
        suppressions: {
          suppress: vi.fn(),
          isSuppressed: vi.fn().mockResolvedValue(false),
        },
        claims: {
          claim: vi.fn().mockResolvedValue(true),
          markSent: vi.fn(),
          markFailed: vi.fn(),
        },
        protector: {
          protect: vi.fn(),
          unprotect: vi.fn().mockResolvedValue({
            title: "Private title",
            recipientEmail: "private@example.com",
          }),
        },
        tokens: {
          issue: vi.fn().mockResolvedValue("opaque-token"),
          resolve: vi.fn(),
          consume: vi.fn(),
        },
        email,
        pushSubscriptions: {
          upsert: vi.fn(),
          findActiveById: vi.fn().mockResolvedValue({
            id: "push-1",
            endpoint: "https://push.example.com/1",
            keys: { p256dh: "A".repeat(87), auth: "B".repeat(22) },
          }),
          revoke,
        },
        webPush: { send: vi.fn().mockResolvedValue("gone") },
        logger: { info: vi.fn(), error: vi.fn() },
        origin: "https://reminders.work",
        now: () => new Date("2026-08-10T00:00:00.000Z"),
      },
      incoming,
    );

    expect(revoke).toHaveBeenCalledWith("push-1", "2026-08-10T00:00:00.000Z");
    expect(email.sendReminder).toHaveBeenCalledOnce();
    expect(incoming.ack).toHaveBeenCalledOnce();
    expect(incoming.retry).not.toHaveBeenCalled();
  });
});
