import { redirect } from "react-router";

import {
  clearAuthSessionCookie,
  readAuthSessionToken,
} from "../auth-session.server";
import { applicationServicesContext } from "../server-context";
import type { Route } from "./+types/auth-logout";

export function loader() {
  return redirect("/");
}

export async function action({ request, context }: Route.ActionArgs) {
  const services = context.get(applicationServicesContext);
  const sessionToken = readAuthSessionToken(request.headers.get("cookie"));
  if (sessionToken !== null) {
    await services.auth.logout(sessionToken).catch(() => undefined);
  }
  return redirect("/", {
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": clearAuthSessionCookie(services.secureAuthCookie),
    },
  });
}
