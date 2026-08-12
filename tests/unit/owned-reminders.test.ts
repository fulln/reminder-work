import { describe, expect, it, vi } from "vitest";

import {
  getOwnedReminderView,
  listOwnedReminders,
  manageOwnedReminder,
} from "../../src/application/use-cases/owned-reminders";
import type { OwnedReminderStore } from "../../src/application/ports/owned-reminder-store";
import type { ReminderRepository } from "../../src/application/ports/reminder-repository";
import type { Reminder } from "../../src/domain/reminder/reminder";

const ownedReminder: Reminder = {
  id: "reminder-1",
  ownerUserId: "user-1",
  version: 2,
  status: "active",
  schedule: {
    kind: "once",
    anchorLocal: "2026-08-12T09:00",
    timeZone: "Asia/Shanghai",
    resolvedUtc: "2026-08-12T01:00:00.000Z",
    recurrence: null,
    leadOffsetsMinutes: [],
  },
  deliveryPlan: { mode: "email", targets: [{ channel: "email" }] },
  recipientRef: "recipient-ref",
  contentCiphertext: "ciphertext",
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
};

describe("owned reminders", () => {
  it("lists the owner's reminders with delivery summary fields", async () => {
    const result = await listOwnedReminders(
      {
        reminders: {
          findByOwner: vi.fn().mockResolvedValue([ownedReminder]),
        } satisfies OwnedReminderStore,
        contentProtector: {
          protect: vi.fn(),
          unprotect: vi.fn().mockResolvedValue({
            title: "Prepare launch notes",
            recipientEmail: "owner@example.com",
          }),
        },
      },
      "user-1",
      "request-1",
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        items: [
          {
            id: "reminder-1",
            title: "Prepare launch notes",
            deliveryLabel: "Email",
            maskedRecipient: "o***r@example.com",
          },
        ],
      },
    });
  });

  it("loads an owned reminder view with actions", async () => {
    const result = await getOwnedReminderView(
      {
        reminders: {
          create: vi.fn(),
          findById: vi.fn().mockResolvedValue(ownedReminder),
          save: vi.fn(),
        } satisfies ReminderRepository,
        contentProtector: {
          protect: vi.fn(),
          unprotect: vi.fn().mockResolvedValue({
            title: "Prepare launch notes",
            recipientEmail: "owner@example.com",
          }),
        },
      },
      "user-1",
      "reminder-1",
      "request-2",
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        id: "reminder-1",
        title: "Prepare launch notes",
        actions: ["complete", "snooze", "reschedule", "cancel"],
      },
    });
  });

  it("lets the owner complete a reminder by id", async () => {
    let current = ownedReminder;
    const result = await manageOwnedReminder(
      {
        clock: { now: () => new Date("2026-08-11T00:00:00.000Z") },
        reminders: {
          create: vi.fn(),
          findById: vi.fn().mockImplementation(() => Promise.resolve(current)),
          save: vi
            .fn()
            .mockImplementation((next: Reminder, expected: number) => {
              if (current.version !== expected) return Promise.resolve(false);
              current = next;
              return Promise.resolve(true);
            }),
        } satisfies ReminderRepository,
      },
      "user-1",
      "reminder-1",
      { expectedVersion: 2, action: "complete" },
      "request-3",
    );

    expect(result).toMatchObject({
      ok: true,
      data: { state: "completed", version: 3 },
    });
  });
});
