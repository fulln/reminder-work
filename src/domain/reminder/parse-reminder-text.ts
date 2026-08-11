import type { RecurrenceRule } from "./schedule";

export interface ReminderParseContext {
  readonly now: string;
  readonly timeZone: string;
}

export interface ParsedReminderText {
  readonly title: string;
  readonly localDate: string;
  readonly localTime: string;
  readonly timeZone: string;
  readonly recurrence: RecurrenceRule | null;
}

export type ReminderParseErrorCode =
  "EMPTY" | "TITLE_MISSING" | "DATE_MISSING" | "TIME_MISSING" | "UNSUPPORTED";

export type ParseReminderTextResult =
  | { readonly ok: true; readonly value: ParsedReminderText }
  | {
      readonly ok: false;
      readonly code: ReminderParseErrorCode;
      readonly message: string;
    };

interface LocalDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

interface LocalTime {
  readonly hour: number;
  readonly minute: number;
}

interface LocalDateTime extends LocalDate, LocalTime {}

interface TextSegment {
  readonly index: number;
  readonly length: number;
}

interface ParsedTime {
  readonly value: LocalTime;
  readonly segment: TextSegment;
}

interface ParsedSchedule {
  readonly localDate: LocalDate;
  readonly recurrence: RecurrenceRule | null;
  readonly segment: TextSegment;
}

const weekdayNumbers = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
} as const;

const weekdayPattern =
  "monday|tuesday|wednesday|thursday|friday|saturday|sunday";

const monthNumbers: Readonly<Record<string, number>> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function segmentOf(match: RegExpExecArray): TextSegment {
  return { index: match.index, length: match[0].length };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDate(date: LocalDate): string {
  return `${String(date.year).padStart(4, "0")}-${pad(date.month)}-${pad(date.day)}`;
}

function formatTime(time: LocalTime): string {
  return `${pad(time.hour)}:${pad(time.minute)}`;
}

function dateFromUtc(date: Date): LocalDate {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function toUtcDate(date: LocalDate): Date {
  return new Date(Date.UTC(date.year, date.month - 1, date.day));
}

function addDays(date: LocalDate, days: number): LocalDate {
  const value = toUtcDate(date);
  value.setUTCDate(value.getUTCDate() + days);
  return dateFromUtc(value);
}

function addMonths(date: LocalDate, months: number): LocalDate {
  const absoluteMonth = date.year * 12 + (date.month - 1) + months;
  return {
    year: Math.floor(absoluteMonth / 12),
    month: (absoluteMonth % 12) + 1,
    day: date.day,
  };
}

function daysInMonth(date: Pick<LocalDate, "year" | "month">): number {
  return new Date(Date.UTC(date.year, date.month, 0)).getUTCDate();
}

function weekdayOf(date: LocalDate): number {
  const day = toUtcDate(date).getUTCDay();
  return day === 0 ? 7 : day;
}

function compareDate(left: LocalDate, right: LocalDate): number {
  return toUtcDate(left).getTime() - toUtcDate(right).getTime();
}

function compareDateTime(
  date: LocalDate,
  time: LocalTime,
  now: LocalDateTime,
): number {
  const dateDifference = compareDate(date, now);
  if (dateDifference !== 0) return dateDifference;
  return time.hour * 60 + time.minute - (now.hour * 60 + now.minute);
}

function validDate(date: LocalDate): LocalDate | null {
  const roundTrip = dateFromUtc(toUtcDate(date));
  return roundTrip.year === date.year &&
    roundTrip.month === date.month &&
    roundTrip.day === date.day
    ? date
    : null;
}

function localParts(instant: Date, timeZone: string): LocalDateTime | null {
  if (Number.isNaN(instant.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(instant);
    const values = new Map(parts.map((part) => [part.type, part.value]));
    const result = {
      year: Number(values.get("year")),
      month: Number(values.get("month")),
      day: Number(values.get("day")),
      hour: Number(values.get("hour")),
      minute: Number(values.get("minute")),
    };
    return Object.values(result).every(Number.isInteger) ? result : null;
  } catch {
    return null;
  }
}

function parseTime(text: string): ParsedTime | null {
  const named = /\b(?:at\s+)?(noon|midnight)\b/i.exec(text);
  if (named !== null) {
    return {
      value:
        named[1]?.toLowerCase() === "noon"
          ? { hour: 12, minute: 0 }
          : { hour: 0, minute: 0 },
      segment: segmentOf(named),
    };
  }

  const twelveHour =
    /\b(?:at\s+)?(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i.exec(text);
  if (twelveHour !== null) {
    const rawHour = Number(twelveHour[1]);
    const hour =
      (rawHour % 12) + (twelveHour[3]?.toLowerCase() === "pm" ? 12 : 0);
    return {
      value: { hour, minute: Number(twelveHour[2] ?? "0") },
      segment: segmentOf(twelveHour),
    };
  }

  const twentyFourHour = /(?:\bat\s+)?\b([01]\d|2[0-3]):([0-5]\d)\b/i.exec(
    text,
  );
  if (twentyFourHour !== null) {
    return {
      value: {
        hour: Number(twentyFourHour[1]),
        minute: Number(twentyFourHour[2]),
      },
      segment: segmentOf(twentyFourHour),
    };
  }

  const hourOnly = /\bat\s+([01]?\d|2[0-3])\b/i.exec(text);
  return hourOnly === null
    ? null
    : {
        value: { hour: Number(hourOnly[1]), minute: 0 },
        segment: segmentOf(hourOnly),
      };
}

function nextAllowedDate(
  now: LocalDateTime,
  time: LocalTime,
  weekdays: readonly number[],
): LocalDate {
  for (let offset = 0; offset <= 7; offset += 1) {
    const date = addDays(now, offset);
    if (
      weekdays.includes(weekdayOf(date)) &&
      compareDateTime(date, time, now) > 0
    ) {
      return date;
    }
  }
  throw new Error("No recurring date could be resolved.");
}

function nextMonthlyDate(
  now: LocalDateTime,
  time: LocalTime,
  requestedDay: number,
): LocalDate {
  for (let offset = 0; offset < 14; offset += 1) {
    const month = addMonths(now, offset);
    const date = {
      year: month.year,
      month: month.month,
      day: Math.min(requestedDay, daysInMonth(month)),
    };
    if (compareDateTime(date, time, now) > 0) return date;
  }
  throw new Error("No monthly date could be resolved.");
}

function parseRecurrence(
  text: string,
  now: LocalDateTime,
  time: LocalTime,
): ParsedSchedule | null {
  const monthly =
    /\b(?:every\s+month|monthly)\s+(?:on\s+(?:the\s+)?)?(\d{1,2})(?:st|nd|rd|th)?\b/i.exec(
      text,
    );
  if (monthly !== null) {
    const dayOfMonth = Number(monthly[1]);
    if (dayOfMonth < 1 || dayOfMonth > 31) return null;
    return {
      localDate: nextMonthlyDate(now, time, dayOfMonth),
      recurrence: {
        kind: "monthly",
        interval: 1,
        dayOfMonth,
        monthEndPolicy: "last-day",
      },
      segment: segmentOf(monthly),
    };
  }

  const weekdays = /\b(?:every\s+weekday|weekdays)\b/i.exec(text);
  if (weekdays !== null) {
    const days = [1, 2, 3, 4, 5] as const;
    return {
      localDate: nextAllowedDate(now, time, days),
      recurrence: { kind: "weekly", interval: 1, weekdays: days },
      segment: segmentOf(weekdays),
    };
  }

  const weekly = new RegExp(`\\bevery\\s+(${weekdayPattern})\\b`, "i").exec(
    text,
  );
  if (weekly !== null) {
    const weekday =
      weekdayNumbers[weekly[1]?.toLowerCase() as keyof typeof weekdayNumbers];
    return {
      localDate: nextAllowedDate(now, time, [weekday]),
      recurrence: { kind: "weekly", interval: 1, weekdays: [weekday] },
      segment: segmentOf(weekly),
    };
  }

  const daily = /\b(?:every\s+day|daily)\b/i.exec(text);
  return daily === null
    ? null
    : {
        localDate: nextAllowedDate(now, time, [1, 2, 3, 4, 5, 6, 7]),
        recurrence: { kind: "daily", interval: 1 },
        segment: segmentOf(daily),
      };
}

function parseOneTimeDate(
  text: string,
  now: LocalDateTime,
): ParsedSchedule | null {
  const relativeDay = /\b(day after tomorrow|tomorrow|today)\b/i.exec(text);
  if (relativeDay !== null) {
    const phrase = relativeDay[1]?.toLowerCase();
    const days = phrase === "today" ? 0 : phrase === "tomorrow" ? 1 : 2;
    return {
      localDate: addDays(now, days),
      recurrence: null,
      segment: segmentOf(relativeDay),
    };
  }

  const nextWeekday = new RegExp(`\\bnext\\s+(${weekdayPattern})\\b`, "i").exec(
    text,
  );
  if (nextWeekday !== null) {
    const weekday =
      weekdayNumbers[
        nextWeekday[1]?.toLowerCase() as keyof typeof weekdayNumbers
      ];
    const difference = (weekday - weekdayOf(now) + 7) % 7 || 7;
    return {
      localDate: addDays(now, difference),
      recurrence: null,
      segment: segmentOf(nextWeekday),
    };
  }

  const isoDate = /\b(?:on\s+)?(\d{4})-(\d{2})-(\d{2})\b/i.exec(text);
  if (isoDate !== null) {
    const date = validDate({
      year: Number(isoDate[1]),
      month: Number(isoDate[2]),
      day: Number(isoDate[3]),
    });
    if (date !== null) {
      return { localDate: date, recurrence: null, segment: segmentOf(isoDate) };
    }
  }

  const namedDate =
    /\b(?:on\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/i.exec(
      text,
    );
  if (namedDate === null) return null;

  const month = monthNumbers[namedDate[1]?.toLowerCase() ?? ""] ?? 0;
  const explicitYear = namedDate[3] === undefined ? null : Number(namedDate[3]);
  let date = validDate({
    year: explicitYear ?? now.year,
    month,
    day: Number(namedDate[2]),
  });
  if (date !== null && explicitYear === null && compareDate(date, now) < 0) {
    date = validDate({ ...date, year: date.year + 1 });
  }
  return date === null
    ? null
    : { localDate: date, recurrence: null, segment: segmentOf(namedDate) };
}

function parseDuration(
  text: string,
  nowInstant: Date,
  nowLocal: LocalDateTime,
  timeZone: string,
): { readonly dateTime: LocalDateTime; readonly segment: TextSegment } | null {
  const duration =
    /\bin\s+(\d{1,4})\s*(minutes?|mins?|hours?|hrs?|days?|weeks?)\b/i.exec(
      text,
    );
  if (duration === null) return null;
  const amount = Number(duration[1]);
  if (amount < 1) return null;
  const unit = duration[2]?.toLowerCase() ?? "";

  let dateTime: LocalDateTime | null;
  if (unit.startsWith("min") || unit.startsWith("h")) {
    const milliseconds = amount * (unit.startsWith("min") ? 60_000 : 3_600_000);
    dateTime = localParts(
      new Date(nowInstant.getTime() + milliseconds),
      timeZone,
    );
  } else {
    const date = addDays(nowLocal, amount * (unit.startsWith("w") ? 7 : 1));
    dateTime = { ...date, hour: nowLocal.hour, minute: nowLocal.minute };
  }
  return dateTime === null ? null : { dateTime, segment: segmentOf(duration) };
}

function removeSegments(
  text: string,
  segments: readonly TextSegment[],
): string {
  return [...segments]
    .sort((left, right) => right.index - left.index)
    .reduce(
      (value, segment) =>
        `${value.slice(0, segment.index)} ${value.slice(segment.index + segment.length)}`,
      text,
    );
}

function titleFromText(text: string, segments: readonly TextSegment[]): string {
  let title = removeSegments(text, segments)
    .replace(/^[\s,.;:!?-]+|[\s,.;:!?-]+$/g, "")
    .replace(/^please\s+/i, "")
    .replace(/^remind\s+me(?:\s+(?:to|about))?\s+/i, "")
    .replace(/^email\s+me(?:\s+to)?\s+/i, "")
    .replace(/^to\s+/i, "")
    .replace(/\s+(?:on|at)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/^remind\s+me$/i.test(title)) title = "";
  return title.length === 0
    ? ""
    : `${title.charAt(0).toUpperCase()}${title.slice(1)}`;
}

export function parseReminderText(
  input: string,
  context: ReminderParseContext,
): ParseReminderTextResult {
  const text = input.replace(/\s+/g, " ").trim();
  if (text.length === 0) {
    return { ok: false, code: "EMPTY", message: "Type a reminder first." };
  }

  const nowInstant = new Date(context.now);
  const now = localParts(nowInstant, context.timeZone);
  if (now === null) {
    return {
      ok: false,
      code: "UNSUPPORTED",
      message: "Choose a valid time zone before parsing the reminder.",
    };
  }

  const duration = parseDuration(text, nowInstant, now, context.timeZone);
  if (duration !== null) {
    const title = titleFromText(text, [duration.segment]);
    if (title.length === 0) {
      return {
        ok: false,
        code: "TITLE_MISSING",
        message: "Add what you want to be reminded about.",
      };
    }
    return {
      ok: true,
      value: {
        title,
        localDate: formatDate(duration.dateTime),
        localTime: formatTime(duration.dateTime),
        timeZone: context.timeZone,
        recurrence: null,
      },
    };
  }

  const time = parseTime(text);
  if (time === null) {
    return {
      ok: false,
      code: "TIME_MISSING",
      message: "Add a time, for example ‘tomorrow at 9am’.",
    };
  }

  const schedule =
    parseRecurrence(text, now, time.value) ?? parseOneTimeDate(text, now);
  if (schedule === null) {
    const ambiguousNumericDate = /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/.test(
      text,
    );
    return {
      ok: false,
      code: ambiguousNumericDate ? "UNSUPPORTED" : "DATE_MISSING",
      message: ambiguousNumericDate
        ? "Use an unambiguous date such as 2026-09-20 or September 20."
        : "Add a date, for example ‘tomorrow’ or ‘next Monday’.",
    };
  }

  const title = titleFromText(text, [time.segment, schedule.segment]);
  if (title.length === 0) {
    return {
      ok: false,
      code: "TITLE_MISSING",
      message: "Add what you want to be reminded about.",
    };
  }

  return {
    ok: true,
    value: {
      title,
      localDate: formatDate(schedule.localDate),
      localTime: formatTime(time.value),
      timeZone: context.timeZone,
      recurrence: schedule.recurrence,
    },
  };
}
