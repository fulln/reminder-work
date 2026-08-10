import { z } from "zod";

export const reminderDeliveryMessageSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("reminder_delivery"),
  reminderId: z.string().min(1),
  expectedVersion: z.number().int().positive(),
  idempotencyKey: z.string().min(1),
  traceId: z.string().min(1),
});

export type ReminderDeliveryMessage = z.infer<
  typeof reminderDeliveryMessageSchema
>;
