import { redirect } from "react-router";

import type { AuthUser } from "../application/ports/auth-service";
import { readAuthSessionToken } from "./auth-session.server";
import type { ApplicationServices } from "./server-context";

export async function authenticatedUser(
  request: Request,
  services: ApplicationServices,
): Promise<AuthUser | null> {
  const sessionToken = readAuthSessionToken(request.headers.get("cookie"));
  if (sessionToken === null) return null;
  const session = await services.auth
    .validateSession(sessionToken)
    .catch(() => null);
  return session?.user ?? null;
}

export async function requireAuthenticatedUser(
  request: Request,
  services: ApplicationServices,
): Promise<AuthUser | Response> {
  const user = await authenticatedUser(request, services);
  if (user === null) return redirect(services.authLoginUrl);
  return user;
}
