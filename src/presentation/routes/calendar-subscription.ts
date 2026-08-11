import { applicationServicesContext } from "../server-context";
import type { Route } from "./+types/calendar-subscription";

export async function loader({ params, context }: Route.LoaderArgs) {
  const token = params.token.endsWith(".ics")
    ? params.token.slice(0, -4)
    : params.token;
  const calendar = await context
    .get(applicationServicesContext)
    .getCalendarFeed(token);
  if (calendar === null) {
    return new Response("This private calendar link is invalid or revoked.", {
      status: 404,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }
  return new Response(calendar, {
    headers: {
      "Cache-Control": "private, no-cache",
      "Content-Disposition": 'inline; filename="reminders-work.ics"',
      "Content-Type": "text/calendar; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
