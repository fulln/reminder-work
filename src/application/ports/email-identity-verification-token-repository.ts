export interface EmailIdentityVerificationClaims {
  readonly identityId: string;
  readonly ownerUserId: string;
  readonly expiresAt: string;
}

export interface EmailIdentityVerificationTokenRepository {
  issue(claims: EmailIdentityVerificationClaims): Promise<string>;
  revoke?(token: string): Promise<void>;
  consume(token: string): Promise<EmailIdentityVerificationClaims | null>;
  resolve(token: string): Promise<EmailIdentityVerificationClaims | null>;
}
