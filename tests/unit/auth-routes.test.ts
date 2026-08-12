import { RouterContextProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";

import type { AuthServicePort } from "../../src/application/ports/auth-service";
import { loader as rootLoader } from "../../src/presentation/root";
import type { ApplicationServices } from "../../src/presentation/server-context";
import { applicationServicesContext } from "../../src/presentation/server-context";
import { loader as callbackLoader } from "../../src/presentation/routes/auth-callback";
import { action as logoutAction } from "../../src/presentation/routes/auth-logout";
import { loader as remindersLoader } from "../../src/presentation/routes/reminders";

function contextWith(
  auth: AuthServicePort,
  overrides: Partial<ApplicationServices> = {},
) {
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
    authLoginUrl:
      "https://auth.elemvisual.com/auth/login?site=reminder-work&return_to=https%3A%2F%2Freminders.work%2Fauth%2Fcallback",
    secureAuthCookie: true,
    reviewReminder: vi.fn(),
    createReminder: () => unavailable("request-1"),
    verifyReminder: () => unavailable("request-1"),
    getCalendarFeed: () => Promise.resolve(null),
    getReminderView: () => unavailable("request-1"),
    manageReminder: () => unavailable("request-1"),
    unsubscribe: () => unavailable("request-1"),
    listOwnedReminders: () => unavailable("request-1"),
    getOwnedReminderView: () => unavailable("request-1"),
    manageOwnedReminder: () => unavailable("request-1"),
    getEmailSettings: () => unavailable("request-1"),
    forgetSavedEmailRecipient: () => unavailable("request-1"),
    verifyEmailIdentity: () => unavailable("request-1"),
    ...overrides,
  };
  const context = new RouterContextProvider();
  context.set(applicationServicesContext, services);
  return context;
}

describe("OAuth relying-site routes", () => {
  it("refreshes the local cookie from the validated upstream expiry", async () => {
    const auth: AuthServicePort = {
      startOAuth: vi.fn(),
      validateSession: vi.fn().mockResolvedValue({
        user: { id: "user-1", displayName: "Ada" },
        expiresAt: "2026-09-10T14:00:00Z",
      }),
      logout: vi.fn(),
    };

    const result = await rootLoader({
      request: new Request("https://reminders.work/", {
        headers: { cookie: "reminder_auth_session=opaque-token" },
      }),
      context: contextWith(auth),
    } as never);

    expect(result.data.user).toEqual({ id: "user-1", displayName: "Ada" });
    const headers = new Headers(result.init?.headers);
    expect(headers.get("set-cookie")).toContain(
      "Expires=Thu, 10 Sep 2026 14:00:00 GMT",
    );
    expect(headers.get("cache-control")).toBe("private, no-store");
  });

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
    expect(response.headers.get("location")).toBe("/reminders");
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

  it("loads only the signed-in user's reminder workspace", async () => {
    const auth: AuthServicePort = {
      startOAuth: vi.fn(),
      validateSession: vi.fn().mockResolvedValue({
        user: { id: "user-1", displayName: "Ada" },
        expiresAt: "2026-09-10T14:00:00Z",
      }),
      logout: vi.fn(),
    };
    const listOwnedReminders = vi.fn().mockResolvedValue({
      ok: true,
      requestId: "request-1",
      data: { items: [] },
    });

    await remindersLoader({
      request: new Request("https://reminders.work/reminders", {
        headers: { cookie: "reminder_auth_session=opaque-token" },
      }),
      context: contextWith(auth, { listOwnedReminders }),
    } as never);

    expect(auth.validateSession).toHaveBeenCalledWith("opaque-token");
    expect(listOwnedReminders).toHaveBeenCalledWith("user-1");
  });

  it("redirects protected reminder pages when the session is invalid", async () => {
    const auth: AuthServicePort = {
      startOAuth: vi.fn(),
      validateSession: vi.fn().mockResolvedValue(null),
      logout: vi.fn(),
    };

    const response = await remindersLoader({
      request: new Request("https://reminders.work/reminders", {
        headers: { cookie: "reminder_auth_session=expired" },
      }),
      context: contextWith(auth),
    } as never);

    expect(response).toBeInstanceOf(Response);
    if (!(response instanceof Response)) return;
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://auth.elemvisual.com/auth/login?site=reminder-work&return_to=https%3A%2F%2Freminders.work%2Fauth%2Fcallback",
    );
  });
});
