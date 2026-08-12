import { describe, expect, it, vi } from "vitest";

import {
  keyedDigest,
  stableDigest,
} from "../../src/infrastructure/cloudflare/crypto/encrypted-json";
import { processEmailSendingEvent } from "../../src/infrastructure/cloudflare/queues/process-email-sending-event";

const keyMaterial = "test-content-encryption-key-32-bytes";
const timestamp = "2026-08-12T08:00:00.000Z";

function eventMessage(
  type:
    "cf.email.sending.message.bounced" | "cf.email.sending.message.complained",
  bounceType?: "hard" | "soft",
) {
  return {
    body: {
      type,
      source: { type: "email.sending", domain: "reminders.work" },
      payload: {
        eventId: "event-1",
        recipient: "Recipient@Example.com",
        ...(bounceType === undefined ? {} : { bounce: { type: bounceType } }),
      },
      metadata: { eventTimestamp: timestamp },
    },
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

function dependencies() {
  return {
    suppressions: {
      suppress: vi.fn().mockResolvedValue(undefined),
      isSuppressed: vi.fn(),
    },
    logger: { info: vi.fn(), error: vi.fn() },
    keyMaterial,
    sendingDomain: "reminders.work",
  };
}

describe("Cloudflare Email Sending events", () => {
  it.each([
    ["hard bounce", "cf.email.sending.message.bounced", "hard"],
    ["complaint", "cf.email.sending.message.complained", undefined],
  ] as const)(
    "suppresses keyed and legacy recipient refs for a %s",
    async (_, type, bounceType) => {
      const deps = dependencies();
      const message = eventMessage(type, bounceType);

      await processEmailSendingEvent(deps, message);

      const normalized = "recipient@example.com";
      expect(deps.suppressions.suppress).toHaveBeenCalledTimes(2);
      expect(deps.suppressions.suppress).toHaveBeenCalledWith(
        await keyedDigest(normalized, keyMaterial),
        timestamp,
      );
      expect(deps.suppressions.suppress).toHaveBeenCalledWith(
        await stableDigest(normalized),
        timestamp,
      );
      expect(message.ack).toHaveBeenCalledOnce();
      expect(message.retry).not.toHaveBeenCalled();
    },
  );

  it("acknowledges a soft bounce without suppressing the recipient", async () => {
    const deps = dependencies();
    const message = eventMessage("cf.email.sending.message.bounced", "soft");

    await processEmailSendingEvent(deps, message);

    expect(deps.suppressions.suppress).not.toHaveBeenCalled();
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it("retries transient D1 failures without logging the recipient address", async () => {
    const deps = dependencies();
    deps.suppressions.suppress.mockRejectedValueOnce(
      new Error("D1 unavailable"),
    );
    const message = eventMessage("cf.email.sending.message.bounced", "hard");

    await processEmailSendingEvent(deps, message);

    expect(message.retry).toHaveBeenCalledOnce();
    expect(message.ack).not.toHaveBeenCalled();
    expect(JSON.stringify(deps.logger.error.mock.calls)).not.toContain(
      "Recipient@Example.com",
    );
  });

  it("rejects malformed or cross-domain events without retrying", async () => {
    const deps = dependencies();
    const malformed = {
      body: { recipient: "recipient@example.com" },
      ack: vi.fn(),
      retry: vi.fn(),
    };
    const otherDomain = eventMessage("cf.email.sending.message.complained");
    otherDomain.body.source.domain = "other.example";

    await processEmailSendingEvent(deps, malformed);
    await processEmailSendingEvent(deps, otherDomain);

    expect(deps.suppressions.suppress).not.toHaveBeenCalled();
    expect(malformed.ack).toHaveBeenCalledOnce();
    expect(otherDomain.ack).toHaveBeenCalledOnce();
  });
});
