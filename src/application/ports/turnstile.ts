export interface TurnstilePort {
  verify(token: string, ipAddress?: string): Promise<boolean>;
}
