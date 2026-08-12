import { z } from "zod";

import { schemaVersion } from "./schema-version";
import { pushSubscriptionSchema } from "./push-subscription";

const optionalEmail = z
  .union([z.literal(""), z.email("Enter a valid email address.")])
  .transform((value) =>
    value === "" ? undefined : value.trim().toLowerCase(),
  );

export const reminderDetailsSchema = z
  .object({
    schemaVersion,
    title: z
      .string()
      .trim()
      .min(1, "Enter what you want to remember.")
      .max(160),
    deliveryMode: z
      .enum(["email", "web_push", "web_push_email_fallback"])
      .default("email"),
    recipientEmail: optionalEmail.optional(),
    pushSubscription: pushSubscriptionSchema.optional(),
    destinationIds: z.array(z.uuid()).max(8).default([]),
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
    leadOffsetsMinutes: z
      .array(z.number().int().nonnegative())
      .max(8)
      .optional(),
  })
  .superRefine((value, context) => {
    if (
      (value.deliveryMode === "email" ||
        value.deliveryMode === "web_push_email_fallback") &&
      value.recipientEmail === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["recipientEmail"],
        message: "Enter a valid email address.",
      });
    }
    if (
      (value.deliveryMode === "web_push" ||
        value.deliveryMode === "web_push_email_fallback") &&
      value.pushSubscription === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["pushSubscription"],
        message: "Enable browser notifications on this device.",
      });
    }
  });

export const reminderDraftSchema = reminderDetailsSchema.extend({
  turnstileToken: z.string().min(1, "Complete the security check."),
});

export type ReminderDetailsInput = z.input<typeof reminderDetailsSchema>;
export type ReminderDetails = z.output<typeof reminderDetailsSchema>;
export type ReminderDraftInput = z.input<typeof reminderDraftSchema>;
export type ReminderDraft = z.output<typeof reminderDraftSchema>;
