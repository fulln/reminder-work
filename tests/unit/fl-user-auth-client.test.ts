import { describe, expect, it, vi } from "vitest";

import { FlUserAuthClient } from "../../src/infrastructure/cloudflare/auth/fl-user-auth-client";

describe("FlUserAuthClient", () => {
  it("starts OAuth with the registered site and exact callback", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        authorizationUrl:
          "https://accounts.google.com/o/oauth2/v2/auth?state=x",
        expiresAt: "2026-08-10T13:00:00Z",
        correlationId: "corr-1",
      }),
    );
    const client = new FlUserAuthClient({
      baseUrl: "https://auth.elemvisual.com/",
      relyingWebsiteId: "reminder-work",
      fetcher,
    });

    const result = await client.startOAuth(
      "google",
      "https://reminders.work/auth/callback",
    );

    expect(result.correlationId).toBe("corr-1");
    expect(fetcher).toHaveBeenCalledWith(
      "https://auth.elemvisual.com/v1/oauth/google/start",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          relyingWebsiteId: "reminder-work",
          returnDestination: "https://reminders.work/auth/callback",
        }),
      }),
    );
  });

  it("accepts only a valid site-bound session response", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        valid: true,
        user: { id: "user-1", displayName: "Ada" },
        expiresAt: "2026-08-10T13:00:00Z",
      }),
    );
    const client = new FlUserAuthClient({
      baseUrl: "https://auth.elemvisual.com",
      relyingWebsiteId: "reminder-work",
      fetcher,
    });

    await expect(client.validateSession("opaque-token")).resolves.toEqual({
      user: { id: "user-1", displayName: "Ada" },
      expiresAt: "2026-08-10T13:00:00Z",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://auth.elemvisual.com/v1/session/validate",
      expect.objectContaining({
        body: JSON.stringify({
          sessionToken: "opaque-token",
          relyingWebsiteId: "reminder-work",
        }),
      }),
    );
  });

  it("rejects an authorization redirect outside the selected provider", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        authorizationUrl: "https://login.example.net/collect",
        expiresAt: "2026-08-10T13:00:00Z",
        correlationId: "corr-2",
      }),
    );
    const client = new FlUserAuthClient({
      baseUrl: "https://auth.elemvisual.com",
      relyingWebsiteId: "reminder-work",
      fetcher,
    });

    await expect(
      client.startOAuth("github", "https://reminders.work/auth/callback"),
    ).rejects.toThrow("temporarily unavailable");
  });
});
