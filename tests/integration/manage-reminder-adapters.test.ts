import { describe, expect, it } from "vitest";

import { manageReminder } from "../../src/application/use-cases/manage-reminder/manage-reminder";
import { unsubscribe } from "../../src/application/use-cases/unsubscribe";
import type { Reminder } from "../../src/domain/reminder/reminder";

const activeReminder: Reminder = {
  id: "reminder-1",
  version: 2,
  status: "active",
  schedule: {
    kind: "once",
    anchorLocal: "2026-08-11T09:00",
    timeZone: "Asia/Shanghai",
    resolvedUtc: "2026-08-11T01:00:00.000Z",
    recurrence: null,
    leadOffsetsMinutes: [],
  },
  recipientRef: "recipient-1",
  contentCiphertext: "ciphertext",
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
};

function dependencies() {
  let current = activeReminder;
  let suppressed = false;
  return {
    clock: { now: () => new Date("2026-08-10T01:00:00.000Z") },
    reminders: {
      create: () => Promise.resolve(),
      findById: () => Promise.resolve(current),
      save: (next: Reminder, expected: number) => {
        if (current.version !== expected) return Promise.resolve(false);
        current = next;
        return Promise.resolve(true);
      },
    },
    tokens: {
      issue: () => Promise.resolve("token"),
      consume: () => Promise.resolve(null),
      resolve: (token: string, purpose: string) => {
        expect(token).toBeTruthy();
        return Promise.resolve({
          reminderId: "reminder-1",
          purpose: purpose as "manage" | "unsubscribe",
          expiresAt: "2026-09-01T00:00:00.000Z",
        });
      },
    },
    suppressions: {
      suppress: () => {
        suppressed = true;
        return Promise.resolve();
      },
      isSuppressed: (recipientRef: string) => {
        expect(recipientRef).toBe("recipient-1");
        return Promise.resolve(suppressed);
      },
    },
  };
}

describe("management adapters", () => {
  it("rejects a stale version without changing state", async () => {
    const result = await manageReminder(
      dependencies(),
      { token: "manage", expectedVersion: 1, action: "complete" },
      "request-1",
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: "REMINDER_CONFLICT" },
    });
  });

  it("makes recipient unsubscribe idempotent", async () => {
    const deps = dependencies();
    const first = await unsubscribe(deps, "unsubscribe", "request-1");
    const second = await unsubscribe(deps, "unsubscribe", "request-2");
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(await deps.suppressions.isSuppressed("recipient-1")).toBe(true);
  });

  it("treats a repeated terminal action as a successful no-op", async () => {
    const deps = dependencies();
    const first = await manageReminder(
      deps,
      { token: "manage", expectedVersion: 2, action: "complete" },
      "request-1",
    );
    const second = await manageReminder(
      deps,
      { token: "manage", expectedVersion: 2, action: "complete" },
      "request-2",
    );
    expect(first).toMatchObject({ ok: true, data: { state: "completed" } });
    expect(second).toMatchObject({ ok: true, data: { state: "completed" } });
  });
});
