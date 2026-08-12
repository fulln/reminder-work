import { redirect } from "react-router";

import { requireAuthenticatedUser } from "../require-auth.server";
import { applicationServicesContext } from "../server-context";
import type { Route } from "./+types/slack-callback";

export async function loader({ request, context }: Route.LoaderArgs) {
  const services = context.get(applicationServicesContext);
  const user = await requireAuthenticatedUser(request, services);
  if (user instanceof Response) return user;
  const url = new URL(request.url);
  const providerError = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (providerError !== null || code === null || state === null) {
    return redirect(
      "/settings/email?error=Slack%20connection%20was%20cancelled%20or%20invalid.",
    );
  }
  const result = await services.finishSlackConnection(user.id, { code, state });
  return result.ok
    ? redirect(
        `/settings/email?connected=${encodeURIComponent(result.data.message)}`,
      )
    : redirect(
        `/settings/email?error=${encodeURIComponent(result.error.form ?? "Slack could not be connected.")}`,
      );
}
