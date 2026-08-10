export interface SuppressionRepository {
  suppress(recipientRef: string, createdAt: string): Promise<void>;
  isSuppressed(recipientRef: string): Promise<boolean>;
}
