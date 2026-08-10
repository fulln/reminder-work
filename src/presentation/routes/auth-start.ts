import { redirect } from "react-router";

import type { AuthProvider } from "../../application/ports/auth-service";
import { applicationServicesContext } from "../server-context";
import type { Route } from "./+types/auth-start";

function isAuthProvider(value: string | undefined): value is AuthProvider {
  return value === "google" || value === "github";
}

export async function action({ params, context }: Route.ActionArgs) {
  if (!isAuthProvider(params.provider)) {
    return redirect("/auth/login?error=unsupported-provider");
  }
  const services = context.get(applicationServicesContext);
  try {
    const result = await services.auth.startOAuth(
      params.provider,
      services.authCallbackUrl,
    );
    return redirect(result.authorizationUrl);
  } catch {
    return redirect("/auth/login?error=service-unavailable");
  }
}
