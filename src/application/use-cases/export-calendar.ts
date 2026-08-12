import type { CalendarExportData } from "../contracts/calendar-export";
import type { RecurrenceRule } from "../../domain/reminder/schedule";
import type { ReminderSchedule } from "../../domain/reminder/schedule";

const encoder = new TextEncoder();
const weekdayCodes = ["", "MO", "TU", "WE", "TH", "FR", "SA", "SU"];

function escapeText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replace(/\r\n|\r|\n/gu, "\\n");
}

function foldLine(line: string): string {
  if (encoder.encode(line).byteLength <= 75) return line;

  const chunks: string[] = [];
  let current = "";
  for (const character of line) {
    if (encoder.encode(current + character).byteLength > 75) {
      chunks.push(current);
      current = ` ${character}`;
    } else {
      current += character;
    }
  }
  if (current !== "") chunks.push(current);
  return chunks.join("\r\n");
}

function calendarDateTime(value: string): string {
  return `${value.slice(0, 4)}${value.slice(5, 7)}${value.slice(8, 10)}T${value.slice(11, 13)}${value.slice(14, 16)}00`;
}

function utcDateTime(value: Date): string {
  return value
    .toISOString()
    .replace(/[-:]/gu, "")
    .replace(/\.\d{3}Z$/u, "Z");
}

function recurrenceRule(recurrence: RecurrenceRule): string {
  const interval = `INTERVAL=${String(recurrence.interval)}`;
  if (recurrence.kind === "daily") return `FREQ=DAILY;${interval}`;
  if (recurrence.kind === "weekly") {
    const byDay = [...new Set(recurrence.weekdays)]
      .sort((left, right) => left - right)
      .map((weekday) => weekdayCodes[weekday])
      .filter((weekday): weekday is string => weekday !== undefined)
      .join(",");
    return `FREQ=WEEKLY;${interval};BYDAY=${byDay}`;
  }
  const byMonthDay =
    recurrence.monthEndPolicy === "last-day" && recurrence.dayOfMonth >= 29
      ? `${String(recurrence.dayOfMonth)},-1;BYSETPOS=1`
      : String(recurrence.dayOfMonth);
  return `FREQ=MONTHLY;${interval};BYMONTHDAY=${byMonthDay}`;
}

function stableUid(source: unknown): string {
  const serialized = JSON.stringify(source);
  let hash = 0xcbf29ce484222325n;
  for (const byte of encoder.encode(serialized)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `${hash.toString(16).padStart(16, "0")}@reminders.work`;
}

interface CalendarEventInput {
  readonly uid: string;
  readonly title: string;
  readonly schedule: ReminderSchedule;
  readonly description: string;
  readonly sequence?: number;
  readonly updatedAt?: string;
}

export interface CalendarFeedEntry {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly schedule: ReminderSchedule;
  readonly updatedAt: string;
}

function eventLines(input: CalendarEventInput, now: Date): readonly string[] {
  return [
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `DTSTAMP:${utcDateTime(now)}`,
    ...(input.updatedAt === undefined
      ? []
      : [`LAST-MODIFIED:${utcDateTime(new Date(input.updatedAt))}`]),
    ...(input.sequence === undefined
      ? []
      : [`SEQUENCE:${String(input.sequence)}`]),
    `DTSTART;TZID=${input.schedule.timeZone}:${calendarDateTime(input.schedule.anchorLocal)}`,
    "DURATION:PT15M",
    `SUMMARY:${escapeText(input.title)}`,
    `DESCRIPTION:${escapeText(input.description)}`,
    "STATUS:CONFIRMED",
    "TRANSP:TRANSPARENT",
    ...(input.schedule.recurrence === null
      ? []
      : [`RRULE:${recurrenceRule(input.schedule.recurrence)}`]),
    ...(input.schedule.leadOffsetsMinutes.length === 0
      ? [0]
      : [...new Set(input.schedule.leadOffsetsMinutes)].sort(
          (left, right) => right - left,
        )
    ).flatMap((minutes) => [
      "BEGIN:VALARM",
      `TRIGGER:${minutes === 0 ? "PT0M" : `-PT${String(minutes)}M`}`,
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(input.title)}`,
      "END:VALARM",
    ]),
    "END:VEVENT",
  ];
}

function calendarDocument(
  events: readonly CalendarEventInput[],
  options: { readonly now: Date; readonly name: string },
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "PRODID:-//Reminders.work//Reminder Calendar Export//EN",
    `X-WR-CALNAME:${escapeText(options.name)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    "X-PUBLISHED-TTL:PT15M",
    ...events.flatMap((event) => eventLines(event, options.now)),
    "END:VCALENDAR",
  ];
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

export function exportReminderCalendar(
  input: CalendarExportData,
  options: { readonly now: Date; readonly origin: string },
): string {
  const description =
    input.managePath === undefined
      ? "Created with Reminders.work"
      : `Created with Reminders.work\nManage: ${options.origin}${input.managePath}`;
  return calendarDocument(
    [
      {
        uid: stableUid({
          title: input.title,
          anchorLocal: input.schedule.anchorLocal,
          timeZone: input.schedule.timeZone,
          recurrence: input.schedule.recurrence,
        }),
        title: input.title,
        schedule: input.schedule,
        description,
      },
    ],
    { now: options.now, name: "Reminders.work" },
  );
}

export function exportReminderCalendarFeed(
  entries: readonly CalendarFeedEntry[],
  options: { readonly now: Date },
): string {
  return calendarDocument(
    entries.map((entry) => ({
      uid: stableUid({ reminderId: entry.id }),
      title: entry.title,
      schedule: entry.schedule,
      description: "Synced from Reminders.work",
      sequence: entry.version,
      updatedAt: entry.updatedAt,
    })),
    { now: options.now, name: "Reminders.work — My reminders" },
  );
}
