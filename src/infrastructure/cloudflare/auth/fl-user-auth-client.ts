import { z } from "zod";

import type {
  AuthProvider,
  AuthServicePort,
  AuthSession,
  OAuthStart,
} from "../../../application/ports/auth-service";

const oauthStartSchema = z.object({
  authorizationUrl: z.url(),
  expiresAt: z.string().min(1),
  correlationId: z.string().min(1),
});

const sessionSchema = z.object({
  valid: z.boolean(),
  user: z
    .object({
      id: z.string().min(1),
      displayName: z.string().min(1),
    })
    .nullable(),
  expiresAt: z.string().nullable(),
});

export class AuthServiceUnavailableError extends Error {
  constructor(readonly reason: string) {
    super("The sign-in service is temporarily unavailable.");
    this.name = "AuthServiceUnavailableError";
  }
}

function unavailable(reason: string): AuthServiceUnavailableError {
  console.warn(`[auth-service] ${reason}`);
  return new AuthServiceUnavailableError(reason);
}

export class FlUserAuthClient implements AuthServicePort {
  readonly #baseUrl: string;
  readonly #relyingWebsiteId: string;
  readonly #fetch: typeof fetch;

  constructor(input: {
    readonly baseUrl: string;
    readonly relyingWebsiteId: string;
    readonly fetcher?: typeof fetch;
  }) {
    this.#baseUrl = input.baseUrl.replace(/\/$/, "");
    this.#relyingWebsiteId = input.relyingWebsiteId;
    this.#fetch = input.fetcher ?? fetch;
  }

  async startOAuth(
    provider: AuthProvider,
    returnDestination: string,
  ): Promise<OAuthStart> {
    const response = await this.#request(`/v1/oauth/${provider}/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        relyingWebsiteId: this.#relyingWebsiteId,
        returnDestination,
      }),
    });
    const result = oauthStartSchema.safeParse(await response.json());
    if (!result.success) throw unavailable("invalid_oauth_start_response");

    const authorizationUrl = new URL(result.data.authorizationUrl);
    const expectedHost =
      provider === "google" ? "accounts.google.com" : "github.com";
    if (
      authorizationUrl.protocol !== "https:" ||
      authorizationUrl.hostname !== expectedHost
    ) {
      throw unavailable("unapproved_authorization_url");
    }
    return result.data;
  }

  async validateSession(sessionToken: string): Promise<AuthSession | null> {
    const response = await this.#request("/v1/session/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionToken,
        relyingWebsiteId: this.#relyingWebsiteId,
      }),
    });
    const result = sessionSchema.safeParse(await response.json());
    if (!result.success) throw unavailable("invalid_session_response");
    if (!result.data.valid || result.data.user === null) return null;

    const expiresAt = result.data.expiresAt;
    if (expiresAt === null || Number.isNaN(Date.parse(expiresAt))) {
      throw unavailable("invalid_session_expiry");
    }
    return { user: result.data.user, expiresAt };
  }

  async logout(sessionToken: string): Promise<void> {
    await this.#request("/v1/logout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionToken,
        relyingWebsiteId: this.#relyingWebsiteId,
      }),
    });
  }

  async #request(path: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}${path}`, init);
    } catch {
      throw unavailable("network_failure");
    }
    if (!response.ok) {
      throw unavailable(`upstream_status_${String(response.status)}`);
    }
    return response;
  }
}
