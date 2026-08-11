export interface ProtectedContent {
  readonly recipientRef: string;
  readonly ciphertext: string;
}

export interface ReminderContent {
  readonly title: string;
  readonly recipientEmail?: string;
}

export interface ContentProtector {
  protect(
    title: string,
    recipientEmail: string | undefined,
    recipientIdentity: string,
  ): Promise<ProtectedContent>;
  unprotect(ciphertext: string): Promise<ReminderContent>;
}
