import { z } from "zod";

export const EMAIL_SENDING_EVENTS_QUEUE = "email-sending-events";

export const emailSendingSuppressionEventSchema = z.object({
  type: z.enum([
    "cf.email.sending.message.bounced",
    "cf.email.sending.message.complained",
  ]),
  source: z.object({
    type: z.literal("email.sending"),
    domain: z.string().min(1).max(253),
  }),
  payload: z.object({
    eventId: z.string().min(1).max(128),
    recipient: z.string().min(3).max(320),
    bounce: z
      .object({
        type: z.enum(["hard", "soft"]),
      })
      .optional(),
  }),
  metadata: z.object({
    eventTimestamp: z.iso.datetime(),
  }),
});

export type EmailSendingSuppressionEvent = z.infer<
  typeof emailSendingSuppressionEventSchema
>;
