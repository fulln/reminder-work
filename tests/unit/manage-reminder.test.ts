import { describe, expect, it } from "vitest";

import { availableReminderActions } from "../../src/application/use-cases/manage-reminder/reminder-management";

describe("reminder management policy", () => {
  it("offers active reminders all non-terminal management actions", () => {
    expect(availableReminderActions("active")).toEqual([
      "complete",
      "snooze",
      "reschedule",
      "cancel",
    ]);
  });

  it.each(["completed", "cancelled", "expired"] as const)(
    "offers terminal %s reminders no delivery action",
    (status) => {
      expect(availableReminderActions(status)).toEqual([]);
    },
  );
});
