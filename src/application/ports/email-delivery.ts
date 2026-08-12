export interface ReminderEmail {
  readonly to: string;
  readonly title: string;
  readonly dueAt: string;
  readonly manageUrl: string;
  readonly unsubscribeUrl: string;
}

export interface VerificationEmail {
  readonly to: string;
  readonly verificationUrl: string;
  readonly expiresAt: string;
}

export interface ReminderEmailPort {
  sendReminder(message: ReminderEmail): Promise<void>;
}

export interface VerificationEmailPort {
  sendVerification(message: VerificationEmail): Promise<void>;
}
