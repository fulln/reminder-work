import type { z } from "zod";

import {
  reminderDetailsSchema,
  reminderDraftSchema,
} from "../contracts/create-reminder";
import type {
  ReminderDetails,
  ReminderDetailsInput,
  ReminderDraftInput,
} from "../contracts/create-reminder";
import { createSchedule } from "../../domain/reminder/create-schedule";
import type { ReminderSchedule } from "../../domain/reminder/schedule";
import { InvalidLocalTimeError } from "../../domain/time/resolve-local-time";

export interface ScheduleReview {
  readonly local: string;
  readonly timeZone: string;
  readonly utc: string;
}

export interface ReviewedReminder extends ReminderDetails {
  readonly schedule: ReminderSchedule;
  readonly review: ScheduleReview;
}

export interface ReviewedReminderForCreate extends ReviewedReminder {
  readonly turnstileToken: string;
}

export type ReviewReminderResult =
  | { readonly ok: true; readonly value: ReviewedReminder }
  | {
      readonly ok: false;
      readonly fields: Readonly<Record<string, readonly string[]>>;
      readonly values: Readonly<Record<string, string>>;
    };

function valuesFromInput(
  input: ReminderDetailsInput,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      typeof value === "string" || typeof value === "number"
        ? String(value)
        : JSON.stringify(value ?? ""),
    ]),
  );
}

function errorsFromZod(
  error: z.ZodError,
): Readonly<Record<string, readonly string[]>> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string") continue;
    (fields[field] ??= []).push(issue.message);
  }
  return fields;
}

export function formatScheduleReview(
  schedule: ReminderSchedule,
  locale: "en" | "zh-CN" = "en",
): ScheduleReview {
  const utc = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hourCycle: "h23",
    timeZoneName: "short",
  }).format(new Date(schedule.resolvedUtc));

  return {
    local: schedule.anchorLocal.replace("T", " · "),
    timeZone: schedule.timeZone,
    utc,
  };
}

export function reviewReminder(
  input: ReminderDetailsInput,
): ReviewReminderResult {
  const parsed = reminderDetailsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fields: errorsFromZod(parsed.error),
      values: valuesFromInput(input),
    };
  }

  try {
    const schedule = createSchedule(parsed.data);
    return {
      ok: true,
      value: {
        ...parsed.data,
        schedule,
        review: formatScheduleReview(schedule),
      },
    };
  } catch (error) {
    const message =
      error instanceof InvalidLocalTimeError
        ? error.message
        : "We could not resolve that scheduled time.";
    return {
      ok: false,
      fields: { localTime: [message] },
      values: valuesFromInput(input),
    };
  }
}

export function reviewReminderForCreate(
  input: ReminderDraftInput,
):
  | { readonly ok: true; readonly value: ReviewedReminderForCreate }
  | Exclude<ReviewReminderResult, { readonly ok: true }> {
  const parsed = reminderDraftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fields: errorsFromZod(parsed.error),
      values: valuesFromInput(input),
    };
  }

  const reviewed = reviewReminder(parsed.data);
  return reviewed.ok
    ? {
        ok: true,
        value: {
          ...reviewed.value,
          turnstileToken: parsed.data.turnstileToken,
        },
      }
    : reviewed;
}
