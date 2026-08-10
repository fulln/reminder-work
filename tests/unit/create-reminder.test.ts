import { describe, expect, it, vi } from "vitest";

import { createReminder } from "../../src/application/use-cases/create-reminder";
import type { CreateReminderDependencies } from "../../src/application/use-cases/create-reminder";

function dependencies(): CreateReminderDependencies {
  return {
    clock: { now: () => new Date("2026-08-10T10:00:00Z") },
    ids: { create: () => "reminder_01" },
    turnstile: { verify: vi.fn().mockResolvedValue(true) },
    contentProtector: {
      protect: vi.fn().mockResolvedValue({
        recipientRef: "recipient_hash",
        ciphertext: "ciphertext",
      }),
      unprotect: vi.fn(),
    },
    pendingStore: {
      createPending: vi.fn().mockResolvedValue(undefined),
    },
    tokens: {
      issue: vi.fn().mockResolvedValue("verification-token"),
      resolve: vi.fn(),
      consume: vi.fn(),
    },
  };
}

describe("createReminder", () => {
  it("creates one pending-verification reminder and returns only masked identity", async () => {
    const deps = dependencies();
    const result = await createReminder(
      deps,
      {
        schemaVersion: 1,
        title: "Prepare launch notes",
        recipientEmail: "owner@example.com",
        localDate: "2026-08-11",
        localTime: "09:00",
        timeZone: "Asia/Shanghai",
        turnstileToken: "test-pass",
      },
      "request-01",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.state).toBe("pending_verification");
      expect(result.data.maskedRecipient).toBe("o***r@example.com");
      expect(result.data.verificationToken).toBe("verification-token");
    }
    expect(deps.pendingStore.createPending).toHaveBeenCalledOnce();
  });

  it("fails closed when Turnstile rejects the request", async () => {
    const deps = dependencies();
    vi.mocked(deps.turnstile.verify).mockResolvedValue(false);
    const result = await createReminder(
      deps,
      {
        schemaVersion: 1,
        title: "Prepare launch notes",
        recipientEmail: "owner@example.com",
        localDate: "2026-08-11",
        localTime: "09:00",
        timeZone: "Asia/Shanghai",
        turnstileToken: "invalid",
      },
      "request-01",
    );
    expect(result.ok).toBe(false);
    expect(deps.pendingStore.createPending).not.toHaveBeenCalled();
  });
});
