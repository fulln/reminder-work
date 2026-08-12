import { redirect } from "react-router";

import { requireAuthenticatedUser } from "../require-auth.server";
import { applicationServicesContext } from "../server-context";
import type { Route } from "./+types/slack-start";

export async function loader({ request, context }: Route.LoaderArgs) {
  const services = context.get(applicationServicesContext);
  const user = await requireAuthenticatedUser(request, services);
  if (user instanceof Response) return user;
  const result = await services.beginSlackConnection(user.id);
  return result.ok
    ? redirect(result.data.authorizationUrl)
    : redirect(
        `/settings/email?error=${encodeURIComponent(result.error.form ?? "Slack could not be connected.")}`,
      );
}
