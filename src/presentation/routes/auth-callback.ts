import { redirect } from "react-router";

import { createAuthSessionCookie } from "../auth-session.server";
import { applicationServicesContext } from "../server-context";
import type { Route } from "./+types/auth-callback";

const privateHeaders = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const sessionToken = url.searchParams.get("session_token");
  if (url.searchParams.get("auth") !== "complete" || sessionToken === null) {
    return redirect("/auth/login?error=invalid-callback", {
      headers: privateHeaders,
    });
  }

  const services = context.get(applicationServicesContext);
  try {
    const session = await services.auth.validateSession(sessionToken);
    if (session === null) {
      return redirect("/auth/login?error=invalid-session", {
        headers: privateHeaders,
      });
    }
    return redirect("/reminders", {
      headers: {
        ...privateHeaders,
        "Set-Cookie": createAuthSessionCookie({
          sessionToken,
          expiresAt: session.expiresAt,
          secure: services.secureAuthCookie,
        }),
      },
    });
  } catch {
    return redirect("/auth/login?error=service-unavailable", {
      headers: privateHeaders,
    });
  }
}
