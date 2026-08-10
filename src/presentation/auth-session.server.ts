export const authSessionCookieName = "reminder_auth_session";

export function readAuthSessionToken(
  cookieHeader: string | null,
): string | null {
  if (cookieHeader === null) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== authSessionCookieName) continue;
    const value = part.slice(separator + 1).trim();
    if (value.length === 0) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }
  return null;
}

export function createAuthSessionCookie(input: {
  readonly sessionToken: string;
  readonly expiresAt: string;
  readonly secure: boolean;
}): string {
  const expiresAt = new Date(input.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    throw new Error("Invalid authentication session expiry.");
  }
  const parts = [
    `${authSessionCookieName}=${encodeURIComponent(input.sessionToken)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expiresAt.toUTCString()}`,
  ];
  if (input.secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearAuthSessionCookie(secure: boolean): string {
  const parts = [
    `${authSessionCookieName}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}
