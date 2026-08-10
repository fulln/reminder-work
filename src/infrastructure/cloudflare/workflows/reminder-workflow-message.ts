import { z } from "zod";

export const reminderWorkflowMessageSchema = z.object({
  schemaVersion: z.literal(1),
  reminderId: z.string().min(1),
  expectedVersion: z.number().int().positive(),
  dueAt: z.iso.datetime(),
  idempotencyKey: z.string().min(1),
  traceId: z.string().min(1),
});

export type ReminderWorkflowMessage = z.infer<
  typeof reminderWorkflowMessageSchema
>;
