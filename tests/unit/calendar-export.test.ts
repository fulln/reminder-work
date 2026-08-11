import { describe, expect, it } from "vitest";

import { calendarExportSchema } from "../../src/application/contracts/calendar-export";
import { exportReminderCalendar } from "../../src/application/use-cases/export-calendar";
import { calendarExportFromForm } from "../../src/presentation/routes/calendar-export";

const baseInput = {
  title: "Prepare launch notes",
  schedule: {
    kind: "once" as const,
    anchorLocal: "2026-08-20T09:00",
    timeZone: "Asia/Shanghai",
    resolvedUtc: "2026-08-20T01:00:00Z",
    recurrence: null,
    leadOffsetsMinutes: [],
  },
};

describe("iCalendar export", () => {
  it("exports a stable, folded and safely escaped one-time event", () => {
    const input = {
      ...baseInput,
      title:
        "准备 launch, notes; confirm\\owner\nwith a deliberately long UTF-8 title for folding",
      managePath: "/manage/abcdefghijklmnopqrstuvwxyz123456",
    };
    const first = exportReminderCalendar(input, {
      now: new Date("2026-08-11T00:00:00Z"),
      origin: "https://reminders.work",
    });
    const second = exportReminderCalendar(input, {
      now: new Date("2026-08-12T00:00:00Z"),
      origin: "https://reminders.work",
    });

    expect(first).toContain("DTSTART;TZID=Asia/Shanghai:20260820T090000\r\n");
    expect(first).toContain("TRIGGER:PT0M\r\n");
    expect(first).toContain("launch\\, notes\\; confirm\\\\owner\\nwith");
    expect(first).toContain(
      "DESCRIPTION:Created with Reminders.work\\nManage: https://reminders.work/",
    );
    expect(first).not.toMatch(/(?<!\r)\n/u);
    for (const line of first.split("\r\n")) {
      expect(new TextEncoder().encode(line).byteLength).toBeLessThanOrEqual(75);
    }

    const uid = /^UID:(.+)$/mu.exec(first)?.[1];
    expect(uid).toMatch(/^[a-f0-9]{16}@reminders\.work\r?$/u);
    expect(second).toContain(`UID:${uid?.replace("\r", "") ?? "missing"}`);
  });

  it("maps supported weekly and month-end recurrence rules", () => {
    const daily = exportReminderCalendar(
      {
        ...baseInput,
        schedule: {
          ...baseInput.schedule,
          kind: "recurring",
          recurrence: { kind: "daily", interval: 3 },
        },
      },
      { now: new Date("2026-08-11T00:00:00Z"), origin: "https://x.test" },
    );
    expect(daily).toContain("RRULE:FREQ=DAILY;INTERVAL=3");

    const weekly = exportReminderCalendar(
      {
        ...baseInput,
        schedule: {
          ...baseInput.schedule,
          kind: "recurring",
          recurrence: {
            kind: "weekly",
            interval: 2,
            weekdays: [5, 1, 3],
          },
          leadOffsetsMinutes: [30, 10],
        },
      },
      { now: new Date("2026-08-11T00:00:00Z"), origin: "https://x.test" },
    );
    expect(weekly).toContain("RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR");
    expect(weekly.match(/BEGIN:VALARM/gu)).toHaveLength(2);

    const monthly = exportReminderCalendar(
      {
        ...baseInput,
        schedule: {
          ...baseInput.schedule,
          kind: "recurring",
          recurrence: {
            kind: "monthly",
            interval: 1,
            dayOfMonth: 31,
            monthEndPolicy: "last-day",
          },
        },
      },
      { now: new Date("2026-08-11T00:00:00Z"), origin: "https://x.test" },
    );
    expect(monthly).toContain(
      "RRULE:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=31,-1;BYSETPOS=1",
    );
  });

  it("rejects malformed schedules and off-site management paths", () => {
    const form = new FormData();
    form.set("title", baseInput.title);
    form.set("schedule", JSON.stringify(baseInput.schedule));
    form.set("managePath", "https://attacker.example/manage/token");

    expect(
      calendarExportSchema.safeParse(calendarExportFromForm(form)).success,
    ).toBe(false);
  });
});
