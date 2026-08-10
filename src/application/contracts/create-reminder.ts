import { z } from "zod";

import { schemaVersion } from "./schema-version";

export const reminderDraftSchema = z.object({
  schemaVersion,
  title: z.string().trim().min(1, "Enter what you want to remember.").max(160),
  recipientEmail: z
    .email("Enter a valid email address.")
    .transform((value) => value.trim().toLowerCase()),
  localDate: z.iso.date("Choose a valid date."),
  localTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a valid time."),
  timeZone: z.string().trim().min(1, "Choose a time zone."),
  disambiguation: z.enum(["earlier", "later"]).optional(),
  recurrence: z
    .discriminatedUnion("kind", [
      z.object({
        kind: z.literal("daily"),
        interval: z.number().int().positive(),
      }),
      z.object({
        kind: z.literal("weekly"),
        interval: z.number().int().positive(),
        weekdays: z.array(z.number().int().min(1).max(7)).min(1),
      }),
      z.object({
        kind: z.literal("monthly"),
        interval: z.number().int().positive(),
        dayOfMonth: z.number().int().min(1).max(31),
        monthEndPolicy: z.enum(["last-day", "skip"]),
      }),
    ])
    .nullable()
    .optional(),
  leadOffsetsMinutes: z.array(z.number().int().nonnegative()).max(8).optional(),
  turnstileToken: z.string().min(1, "Complete the security check."),
});

export type ReminderDraftInput = z.input<typeof reminderDraftSchema>;
export type ReminderDraft = z.output<typeof reminderDraftSchema>;
