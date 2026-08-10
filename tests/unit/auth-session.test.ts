import { describe, expect, it } from "vitest";

import {
  authSessionCookieName,
  clearAuthSessionCookie,
  createAuthSessionCookie,
  readAuthSessionToken,
} from "../../src/presentation/auth-session.server";

describe("authentication session cookie", () => {
  it("round-trips an opaque token through an HttpOnly production cookie", () => {
    const cookie = createAuthSessionCookie({
      sessionToken: "opaque/token+value",
      expiresAt: "2026-08-10T13:00:00Z",
      secure: true,
    });

    expect(cookie).toContain(`${authSessionCookieName}=opaque%2Ftoken%2Bvalue`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    expect(readAuthSessionToken(cookie)).toBe("opaque/token+value");
  });

  it("clears the same cookie without exposing the token", () => {
    const cookie = clearAuthSessionCookie(true);
    expect(cookie).toContain(`${authSessionCookieName}=`);
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("HttpOnly");
  });
});
