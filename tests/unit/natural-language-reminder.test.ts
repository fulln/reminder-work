import { describe, expect, it } from "vitest";

import { parseReminderText } from "../../src/domain/reminder/parse-reminder-text";

const context = {
  now: "2026-08-11T02:15:00Z",
  timeZone: "Asia/Shanghai",
} as const;

describe("parseReminderText", () => {
  it("parses a one-time reminder expressed with tomorrow and a 12-hour time", () => {
    const result = parseReminderText(
      "Remind me to submit the report tomorrow at 9am",
      context,
    );

    expect(result).toEqual({
      ok: true,
      value: {
        title: "Submit the report",
        localDate: "2026-08-12",
        localTime: "09:00",
        timeZone: "Asia/Shanghai",
        recurrence: null,
      },
    });
  });

  it("resolves relative durations across a local date boundary", () => {
    const result = parseReminderText("Remind me to stretch in 14 hours", {
      now: "2026-08-11T10:30:00Z",
      timeZone: "Asia/Shanghai",
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        title: "Stretch",
        localDate: "2026-08-12",
        localTime: "08:30",
        recurrence: null,
      },
    });
  });

  it("parses next weekday without treating today as next week", () => {
    const result = parseReminderText(
      "Call the supplier next Monday at 4:30pm",
      context,
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        title: "Call the supplier",
        localDate: "2026-08-17",
        localTime: "16:30",
        recurrence: null,
      },
    });
  });

  it.each([
    [
      "Review priorities every day at 11am",
      "2026-08-11",
      { kind: "daily", interval: 1 },
    ],
    [
      "Send the report every Friday at 4pm",
      "2026-08-14",
      { kind: "weekly", interval: 1, weekdays: [5] },
    ],
    [
      "Check the queue every weekday at 9am",
      "2026-08-12",
      { kind: "weekly", interval: 1, weekdays: [1, 2, 3, 4, 5] },
    ],
    [
      "Pay the invoice monthly on the 15th at noon",
      "2026-08-15",
      {
        kind: "monthly",
        interval: 1,
        dayOfMonth: 15,
        monthEndPolicy: "last-day",
      },
    ],
  ])("parses recurring input: %s", (text, localDate, recurrence) => {
    const result = parseReminderText(text, context);

    expect(result).toMatchObject({
      ok: true,
      value: { localDate, recurrence },
    });
  });

  it("accepts an unambiguous ISO date", () => {
    const result = parseReminderText(
      "Renew the certificate on 2026-09-20 at 09:45",
      context,
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        title: "Renew the certificate",
        localDate: "2026-09-20",
        localTime: "09:45",
      },
    });
  });

  it.each([
    ["Remind me to submit the report tomorrow", "TIME_MISSING", "Add a time"],
    ["Remind me to submit the report at 9am", "DATE_MISSING", "Add a date"],
    ["Tomorrow at 9am", "TITLE_MISSING", "Add what"],
    ["", "EMPTY", "Type a reminder"],
  ])("reports an actionable parse error for %j", (text, code, message) => {
    const result = parseReminderText(text, context);

    expect(result).toMatchObject({ ok: false, code });
    if (!result.ok) expect(result.message).toContain(message);
  });
});
