export interface ConsentPort {
  isSuppressed(recipientRef: string): Promise<boolean>;
  suppress(recipientRef: string, reason: string): Promise<void>;
}
