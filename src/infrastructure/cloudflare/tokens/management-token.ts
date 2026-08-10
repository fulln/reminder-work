import type { TokenClaims, TokenPort } from "../../../application/ports/token";

const DAYS_90_MS = 90 * 24 * 60 * 60 * 1000;

export interface ManagementTokens {
  readonly manageToken: string;
  readonly unsubscribeToken: string;
}

export async function issueManagementTokens(
  tokens: TokenPort,
  reminderId: string,
  now: Date,
): Promise<ManagementTokens> {
  const expiresAt = new Date(now.getTime() + DAYS_90_MS).toISOString();
  const claims = (purpose: TokenClaims["purpose"]): TokenClaims => ({
    reminderId,
    purpose,
    expiresAt,
  });
  const [manageToken, unsubscribeToken] = await Promise.all([
    tokens.issue(claims("manage")),
    tokens.issue(claims("unsubscribe")),
  ]);
  return { manageToken, unsubscribeToken };
}
