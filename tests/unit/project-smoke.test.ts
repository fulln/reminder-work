import { describe, expect, it } from "vitest";

describe("project test harness", () => {
  it("runs TypeScript unit tests", () => {
    expect("Reminders.work").toContain("Reminder");
  });
});
