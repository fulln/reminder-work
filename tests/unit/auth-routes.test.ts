import { RouterContextProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";

import type { AuthServicePort } from "../../src/application/ports/auth-service";
import type { ApplicationServices } from "../../src/presentation/server-context";
import { applicationServicesContext } from "../../src/presentation/server-context";
import { loader as callbackLoader } from "../../src/presentation/routes/auth-callback";
import { action as logoutAction } from "../../src/presentation/routes/auth-logout";

function contextWith(auth: AuthServicePort) {
  const unavailable = (requestId: string) =>
    Promise.resolve({
      ok: false as const,
      requestId,
      error: { code: "UNAVAILABLE", retryable: false },
    });
  const services: ApplicationServices = {
    requestId: "request-1",
    showLocalVerificationPreview: false,
    turnstileSiteKey: "site-key",
    vapidPublicKey: "vapid-public-key",
    auth,
    authCallbackUrl: "https://reminders.work/auth/callback",
    secureAuthCookie: true,
    reviewReminder: vi.fn(),
    createReminder: () => unavailable("request-1"),
    verifyReminder: () => unavailable("request-1"),
    getReminderView: () => unavailable("request-1"),
    manageReminder: () => unavailable("request-1"),
    unsubscribe: () => unavailable("request-1"),
  };
  const context = new RouterContextProvider();
  context.set(applicationServicesContext, services);
  return context;
}

describe("OAuth relying-site routes", () => {
  it("validates the callback before storing an HttpOnly session", async () => {
    const auth: AuthServicePort = {
      startOAuth: vi.fn(),
      validateSession: vi.fn().mockResolvedValue({
        user: { id: "user-1", displayName: "Ada" },
        expiresAt: "2026-08-10T14:00:00Z",
      }),
      logout: vi.fn(),
    };
    const response = await callbackLoader({
      request: new Request(
        "https://reminders.work/auth/callback?auth=complete&session_token=opaque-token",
      ),
      context: contextWith(auth),
    } as never);

    expect(auth.validateSession).toHaveBeenCalledWith("opaque-token");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("revokes upstream and clears the local session on logout", async () => {
    const auth: AuthServicePort = {
      startOAuth: vi.fn(),
      validateSession: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
    };
    const response = await logoutAction({
      request: new Request("https://reminders.work/auth/logout", {
        method: "POST",
        headers: { cookie: "reminder_auth_session=opaque-token" },
      }),
      context: contextWith(auth),
    } as never);

    expect(auth.logout).toHaveBeenCalledWith("opaque-token");
    expect(response.status).toBe(302);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
