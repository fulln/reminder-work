import { z } from "zod";

import type { ReminderSchedule } from "../../domain/reminder/schedule";

const recurrenceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("daily"),
    interval: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal("weekly"),
    interval: z.number().int().positive(),
    weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  }),
  z.object({
    kind: z.literal("monthly"),
    interval: z.number().int().positive(),
    dayOfMonth: z.number().int().min(1).max(31),
    monthEndPolicy: z.enum(["last-day", "skip"]),
  }),
]);

function validTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

const scheduleSchema = z
  .object({
    kind: z.enum(["once", "recurring"]),
    anchorLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u),
    timeZone: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9._+-]+(?:\/[A-Za-z0-9._+-]+)*$/u)
      .refine(validTimeZone),
    resolvedUtc: z.iso.datetime({ offset: true }),
    recurrence: recurrenceSchema.nullable(),
    leadOffsetsMinutes: z.array(z.number().int().nonnegative()).max(8),
  })
  .superRefine((value, context) => {
    if (
      (value.kind === "once" && value.recurrence !== null) ||
      (value.kind === "recurring" && value.recurrence === null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["recurrence"],
        message: "The calendar recurrence does not match the schedule.",
      });
    }
  });

export const calendarExportSchema = z.object({
  title: z.string().trim().min(1).max(160),
  schedule: scheduleSchema,
  managePath: z
    .string()
    .regex(/^\/manage\/[A-Za-z0-9._~-]{16,2048}$/u)
    .optional(),
});

export interface CalendarExportData {
  readonly title: string;
  readonly schedule: ReminderSchedule;
  readonly managePath?: string;
}

export type CalendarExportInput = z.infer<typeof calendarExportSchema>;
