import { Form } from "react-router";

import { applicationServicesContext } from "../server-context";
import type { Route } from "./+types/unsubscribe";

export const meta: Route.MetaFunction = () => [
  { title: "Unsubscribe — Reminders.work" },
  { name: "robots", content: "noindex, nofollow" },
];

export function action({ params, context }: Route.ActionArgs) {
  return context.get(applicationServicesContext).unsubscribe(params.token);
}

export default function UnsubscribeRoute({ actionData }: Route.ComponentProps) {
  const done = actionData?.ok === true;
  return (
    <main id="main-content" className="error-page">
      <p className="eyebrow">Email preferences</p>
      <h1>{done ? "You are unsubscribed" : "Stop reminder emails"}</h1>
      <p>
        {done
          ? "This address will not receive future email reminders from any creator."
          : "This blocks all future Reminders.work email delivery to this address and also cancels the reminder linked to this email. A reminder creator cannot reverse this choice."}
      </p>
      {!done ? (
        <Form method="post">
          <button type="submit">Stop all reminder emails</button>
        </Form>
      ) : null}
    </main>
  );
}
