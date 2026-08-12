import { describe, expect, it } from "vitest";

import { reviewReminder } from "../../src/application/use-cases/review-reminder";
import {
  draftFromForm,
  handleComposerAction,
} from "../../src/presentation/routes/home";
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
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields.recipientEmail).toBeDefined();
      expect(result.values.title).toBe("Prepare launch notes");
    }
  });
});

describe("composer create response", () => {
  it("returns the active reminder payload without verification-only fields", async () => {
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
      vapidPublicKey: "vapid-public-key",
      auth: {
        startOAuth: () => Promise.reject(new Error("not used")),
        validateSession: () => Promise.resolve(null),
        logout: () => Promise.resolve(),
      },
      authCallbackUrl: "http://localhost:5173/auth/callback",
      authLoginUrl:
        "http://localhost:8787/auth/login?site=reminder-work&return_to=http%3A%2F%2Flocalhost%3A5173%2Fauth%2Fcallback",
      secureAuthCookie: false,
      reviewReminder,
      createReminder: () =>
        Promise.resolve({
          ok: true,
          requestId: "request-1",
          data: {
            state: "active",
            channels: ["email"] as const,
            manageToken: "manage-token",
          },
        }),
      verifyReminder: () => unavailable("request-1"),
      getCalendarFeed: () => Promise.resolve(null),
      getReminderView: () => unavailable("request-1"),
      manageReminder: () => unavailable("request-1"),
      unsubscribe: () => unavailable("request-1"),
      listOwnedReminders: () => unavailable("request-1"),
      getOwnedReminderView: () => unavailable("request-1"),
      manageOwnedReminder: () => unavailable("request-1"),
      getEmailSettings: () => unavailable("request-1"),
      forgetSavedEmailRecipient: () => unavailable("request-1"),
      verifyEmailIdentity: () => unavailable("request-1"),
    };
    const form = new FormData();
    form.set("intent", "create");
    const result = await handleComposerAction(form, services);
    expect(result).toMatchObject({
      stage: "created",
      result: {
        state: "active",
        channels: ["email"],
        manageToken: "manage-token",
      },
    });
    if (result?.stage === "created") {
      expect(JSON.stringify(result)).not.toContain("verificationToken");
      expect(JSON.stringify(result)).not.toContain("maskedRecipient");
    }
  });
});

describe("draftFromForm recurrence", () => {
  it("preserves a parsed weekday schedule instead of reducing it to the anchor day", () => {
    const form = new FormData();
    form.set("recurrenceKind", "weekly");
    form.set("recurrenceInterval", "1");
    form.append("recurrenceWeekdays", "1");
    form.append("recurrenceWeekdays", "2");
    form.append("recurrenceWeekdays", "3");
    form.append("recurrenceWeekdays", "4");
    form.append("recurrenceWeekdays", "5");
    form.set("localDate", "2026-08-12");

    expect(draftFromForm(form).recurrence).toEqual({
      kind: "weekly",
      interval: 1,
      weekdays: [1, 2, 3, 4, 5],
    });
  });
});
