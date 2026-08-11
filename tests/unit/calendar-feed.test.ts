import { describe, expect, it, vi } from "vitest";

import { getCalendarFeed } from "../../src/application/use-cases/get-calendar-feed";
import { verifyReminder } from "../../src/application/use-cases/verify-reminder";
import type { Reminder } from "../../src/domain/reminder/reminder";

const reminder: Reminder = {
  id: "reminder-1",
  version: 1,
  status: "pending_verification",
  schedule: {
    kind: "once",
    anchorLocal: "2026-08-20T09:00",
    timeZone: "Asia/Shanghai",
    resolvedUtc: "2026-08-20T01:00:00Z",
    recurrence: null,
    leadOffsetsMinutes: [10],
  },
  deliveryPlan: { mode: "email", targets: [{ channel: "email" }] },
  recipientRef: "recipient-ref",
  contentCiphertext: "ciphertext",
  createdAt: "2026-08-11T00:00:00Z",
  updatedAt: "2026-08-11T00:00:00Z",
};

describe("private calendar feed", () => {
  it("returns no calendar for an invalid or revoked token", async () => {
    const result = await getCalendarFeed(
      {
        feeds: {
          issue: vi.fn(),
          findReminders: vi.fn().mockResolvedValue(null),
        },
        contentProtector: {
          protect: vi.fn(),
          unprotect: vi.fn(),
        },
        now: () => new Date("2026-08-11T00:00:00Z"),
      },
      "invalid-token",
    );

    expect(result).toBeNull();
  });

  it("decrypts only the reminders selected by the private feed store", async () => {
    const result = await getCalendarFeed(
      {
        feeds: {
          issue: vi.fn(),
          findReminders: vi
            .fn()
            .mockResolvedValue([{ ...reminder, status: "active" }]),
        },
        contentProtector: {
          protect: vi.fn(),
          unprotect: vi.fn().mockResolvedValue({
            title: "Prepare launch notes",
            recipientEmail: "owner@example.com",
          }),
        },
        now: () => new Date("2026-08-11T00:00:00Z"),
      },
      "private-token",
    );

    expect(result).toContain("SUMMARY:Prepare launch notes");
    expect(result).not.toContain("owner@example.com");
  });

  it("issues subscription links only after successful email verification", async () => {
    const calendarFeeds = {
      issue: vi.fn().mockResolvedValue("private-feed-token"),
      findReminders: vi.fn(),
    };
    const result = await verifyReminder(
      {
        clock: { now: () => new Date("2026-08-11T00:00:00Z") },
        reminders: {
          create: vi.fn(),
          findById: vi.fn().mockResolvedValue(reminder),
          save: vi.fn().mockResolvedValue(true),
        },
        tokens: {
          issue: vi
            .fn()
            .mockResolvedValueOnce("manage-token")
            .mockResolvedValueOnce("unsubscribe-token"),
          resolve: vi.fn(),
          consume: vi.fn().mockResolvedValue({
            reminderId: reminder.id,
            purpose: "verify",
            expiresAt: "2026-08-11T00:30:00Z",
          }),
        },
        scheduler: { schedule: vi.fn().mockResolvedValue(undefined) },
        calendarFeeds,
        appOrigin: "https://reminders.work",
      },
      "verification-token",
      "request-1",
    );

    expect(calendarFeeds.issue).toHaveBeenCalledWith(
      "recipient-ref",
      "2026-08-11T00:00:00.000Z",
    );
    expect(result).toMatchObject({
      ok: true,
      data: {
        calendarFeedUrl:
          "https://reminders.work/calendar/private-feed-token.ics",
        calendarSubscriptionUrl:
          "webcal://reminders.work/calendar/private-feed-token.ics",
      },
    });
  });
});
