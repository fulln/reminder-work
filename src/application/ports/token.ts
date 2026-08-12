export interface TokenClaims {
  readonly reminderId: string;
  readonly purpose: "verify" | "manage" | "unsubscribe";
  readonly expiresAt: string;
}

export interface TokenPort {
  issue(claims: TokenClaims): Promise<string>;
  revoke?(token: string, purpose: TokenClaims["purpose"]): Promise<void>;
  resolve(
    token: string,
    purpose: TokenClaims["purpose"],
  ): Promise<TokenClaims | null>;
  consume(
    token: string,
    purpose: TokenClaims["purpose"],
  ): Promise<TokenClaims | null>;
}
