import { Form } from "react-router";

import { applicationServicesContext } from "../server-context";
import type { Route } from "./+types/verify-email-identity";

export const meta: Route.MetaFunction = () => [
  { title: "Verify email — Reminders.work" },
  { name: "robots", content: "noindex, nofollow" },
];

export function action({ params, context }: Route.ActionArgs) {
  return context
    .get(applicationServicesContext)
    .verifyEmailIdentity(params.token);
}

export default function VerifyEmailIdentityRoute({
  actionData,
}: Route.ComponentProps) {
  const verified = actionData?.ok === true;
  return (
    <main id="main-content" className="error-page">
      <p className="eyebrow">Secure email verification</p>
      <h1>{verified ? "Email verified" : "Verify your email"}</h1>
      {verified ? (
        <>
          <p>This address is ready for new reminders.</p>
          <a href="/settings/email">Return to email settings</a>
        </>
      ) : actionData?.ok === false ? (
        <p>{actionData.error.form}</p>
      ) : (
        <>
          <p>
            Confirm that you control this address before using it for reminder
            delivery.
          </p>
          <Form method="post">
            <button type="submit">Verify email</button>
          </Form>
        </>
      )}
    </main>
  );
}
