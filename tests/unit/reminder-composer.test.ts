import { describe, expect, it } from "vitest";

import { reviewReminder } from "../../src/application/use-cases/review-reminder";
import { handleComposerAction } from "../../src/presentation/routes/home";
import type { ApplicationServices } from "../../src/presentation/server-context";

describe("reviewReminder", () => {
  it("normalizes a valid draft and exposes local, zone, and UTC review labels", () => {
    const result = reviewReminder({
      schemaVersion: 1,
      title: "Prepare launch notes",
      recipientEmail: "Owner@Example.com",
      localDate: "2026-08-11",
      localTime: "09:00",
      timeZone: "Asia/Shanghai",
      turnstileToken: "test-pass",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.recipientEmail).toBe("owner@example.com");
      expect(result.value.schedule.resolvedUtc).toBe("2026-08-11T01:00:00Z");
      expect(result.value.review.timeZone).toBe("Asia/Shanghai");
    }
  });

  it("returns field-addressable validation errors without discarding valid input", () => {
    const result = reviewReminder({
      schemaVersion: 1,
      title: "Prepare launch notes",
      recipientEmail: "not-an-email",
      localDate: "2026-08-11",
      localTime: "09:00",
      timeZone: "Asia/Shanghai",
      turnstileToken: "test-pass",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields.recipientEmail).toBeDefined();
      expect(result.values.title).toBe("Prepare launch notes");
    }
  });
});

describe("composer response privacy", () => {
  it("removes the local verification preview token outside local development", async () => {
    const unavailable = (requestId: string) =>
      Promise.resolve({
        ok: false as const,
        requestId,
        error: { code: "UNAVAILABLE", retryable: false },
      });
    const services: ApplicationServices = {
      requestId: "request-1",
      showLocalVerificationPreview: false,
      turnstileSiteKey: "site-key",
      auth: {
        startOAuth: () => Promise.reject(new Error("not used")),
        validateSession: () => Promise.resolve(null),
        logout: () => Promise.resolve(),
      },
      authCallbackUrl: "http://localhost:5173/auth/callback",
      secureAuthCookie: false,
      reviewReminder,
      createReminder: () =>
        Promise.resolve({
          ok: true,
          requestId: "request-1",
          data: {
            state: "pending_verification",
            maskedRecipient: "o***r@example.com",
            expiresAt: "2026-08-10T01:00:00.000Z",
            verificationToken: "must-not-leak",
          },
        }),
      verifyReminder: () => unavailable("request-1"),
      getReminderView: () => unavailable("request-1"),
      manageReminder: () => unavailable("request-1"),
      unsubscribe: () => unavailable("request-1"),
    };
    const form = new FormData();
    form.set("intent", "create");
    const result = await handleComposerAction(form, services);
    expect(result).toMatchObject({ stage: "created" });
    if (result?.stage === "created") {
      expect(result.result.verificationToken).toBeUndefined();
      expect(JSON.stringify(result)).not.toContain("must-not-leak");
    }
  });
});
