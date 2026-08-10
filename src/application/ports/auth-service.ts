export type AuthProvider = "google" | "github";

export interface AuthUser {
  readonly id: string;
  readonly displayName: string;
}

export interface AuthSession {
  readonly user: AuthUser;
  readonly expiresAt: string;
}

export interface OAuthStart {
  readonly authorizationUrl: string;
  readonly expiresAt: string;
  readonly correlationId: string;
}

export interface AuthServicePort {
  startOAuth(
    provider: AuthProvider,
    returnDestination: string,
  ): Promise<OAuthStart>;
  validateSession(sessionToken: string): Promise<AuthSession | null>;
  logout(sessionToken: string): Promise<void>;
}
