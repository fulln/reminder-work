import { Form } from "react-router";

import { applicationServicesContext } from "../server-context";
import type { Route } from "./+types/verify";

export const meta: Route.MetaFunction = () => [
  { title: "Verify reminder — Reminders.work" },
  { name: "robots", content: "noindex, nofollow" },
];

export function action({ params, context }: Route.ActionArgs) {
  const token = params.token;
  return context.get(applicationServicesContext).verifyReminder(token);
}

export default function VerifyReminder({ actionData }: Route.ComponentProps) {
  const verified = actionData?.ok === true;
  return (
    <main id="main-content" className="error-page">
      <p className="eyebrow">Secure email verification</p>
      <h1>{verified ? "Reminder activated" : "Verify your email"}</h1>
      {verified ? (
        <>
          <p>
            Your reminder is active. Keep the secure link to make changes later.
          </p>
          <p>
            <a href={`/manage/${actionData.data.manageToken}`}>
              Manage reminder
            </a>
            {" · "}
            <a href={`/unsubscribe/${actionData.data.unsubscribeToken}`}>
              Unsubscribe
            </a>
          </p>
          {actionData.data.calendarSubscriptionUrl === undefined ? null : (
            <section aria-labelledby="calendar-sync-title">
              <h2 id="calendar-sync-title">Keep your calendar in sync</h2>
              <p>
                Subscribe once. Future verified reminders sent to this email
                address will appear automatically in the same private calendar.
              </p>
              <p>
                <a href={actionData.data.calendarSubscriptionUrl}>
                  Subscribe to my reminders calendar
                </a>
              </p>
              {actionData.data.calendarFeedUrl === undefined ? null : (
                <details>
                  <summary>Using Google Calendar?</summary>
                  <p>
                    On a computer, add a calendar “From URL” and use this{" "}
                    <a href={actionData.data.calendarFeedUrl}>
                      private calendar address
                    </a>
                    . Keep the address private because it grants read access to
                    your reminder schedule.
                  </p>
                </details>
              )}
            </section>
          )}
        </>
      ) : actionData?.ok === false ? (
        <p>This verification link is invalid or has expired.</p>
      ) : (
        <>
          <p>
            Confirm that you control the recipient address before Reminders.work
            schedules anything.
          </p>
          <Form method="post">
            <button type="submit">Verify email</button>
          </Form>
        </>
      )}
    </main>
  );
}
