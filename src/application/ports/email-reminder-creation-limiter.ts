export interface EmailReminderCreationAttempt {
  readonly id: string;
  readonly actorRef: string;
  readonly recipientRef: string;
  readonly createdAt: string;
  readonly discardBefore: string;
  readonly actorLimit: number;
  readonly recipientLimit: number;
}

export interface EmailReminderCreationLimiter {
  reserve(attempt: EmailReminderCreationAttempt): Promise<boolean>;
}
