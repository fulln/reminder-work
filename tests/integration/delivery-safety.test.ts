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
      logger: { info: vi.fn(), error: vi.fn() },
      origin: "https://reminder.work",
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
});
