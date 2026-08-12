import { Form } from "react-router";

import { AccountShell } from "../features/account/AccountShell";
import styles from "../features/account/AccountWorkspace.module.css";
import { requireAuthenticatedUser } from "../require-auth.server";
import { applicationServicesContext } from "../server-context";
import type { Route } from "./+types/email-settings";

export const meta: Route.MetaFunction = () => [
  { title: "Saved delivery addresses — Reminders.work" },
  { name: "robots", content: "noindex, nofollow" },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const services = context.get(applicationServicesContext);
  const user = await requireAuthenticatedUser(request, services);
  if (user instanceof Response) return user;
  return services.getEmailSettings(user.id);
}

export async function action({ request, context }: Route.ActionArgs) {
  const services = context.get(applicationServicesContext);
  const user = await requireAuthenticatedUser(request, services);
  if (user instanceof Response) return user;
  const form = await request.formData();
  const intent = form.get("intent");
  const identityIdValue = form.get("identityId");
  const identityId = typeof identityIdValue === "string" ? identityIdValue : "";
  if (intent === "forget") {
    return services.forgetSavedEmailRecipient(user.id, identityId);
  }
  return {
    ok: false as const,
    requestId: services.requestId,
    error: {
      code: "ACTION_INVALID",
      retryable: false,
      form: "Choose a valid saved address action.",
    },
  };
}

export default function EmailSettingsRoute({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const identities = loaderData.ok ? loaderData.data.identities : [];

  return (
    <AccountShell>
      <p className="eyebrow">Delivery addresses</p>
      <h1>Saved delivery addresses</h1>
      <p className={styles.lede}>
        Reminders sent by email go out directly when due. Recipients can
        unsubscribe from any message they receive.
      </p>

      {actionData?.ok === true ? (
        <p className={styles.feedback} role="status">
          {actionData.data.message}
        </p>
      ) : actionData?.ok === false ? (
        <p className={styles.error} role="alert">
          {actionData.error.form ?? "The saved address could not be changed."}
        </p>
      ) : !loaderData.ok ? (
        <p className={styles.error} role="alert">
          {loaderData.error.form ??
            "Saved delivery addresses could not be loaded."}
        </p>
      ) : null}

      {identities.length === 0 ? (
        <section className={styles.empty}>
          <h2>No saved delivery addresses</h2>
          <p className={styles.muted}>
            Addresses appear here after you create email reminders.
          </p>
        </section>
      ) : (
        <div className={styles.list}>
          {identities.map((identity) => (
            <article className={styles.identity} key={identity.id}>
              <div>
                <div className={styles.identityHeading}>
                  <h2>{identity.email}</h2>
                  <span className={identityClass(identity.status)}>
                    {identityLabel(identity.status)}
                  </span>
                </div>
                <p className={styles.emailMeta}>
                  Used by {identity.activeReminderCount} active reminder
                  {identity.activeReminderCount === 1 ? "" : "s"} · Last used{" "}
                  {identity.lastUsedAtLabel}
                </p>
              </div>
              <div className={styles.actions}>
                <Form method="post">
                  <input type="hidden" name="identityId" value={identity.id} />
                  <button
                    className={styles.secondaryButton}
                    name="intent"
                    value="forget"
                  >
                    Forget saved address
                  </button>
                </Form>
              </div>
              <p className={styles.identityNote}>
                {identity.status === "active"
                  ? "New reminders can reuse this address until the recipient unsubscribes or delivery is blocked."
                  : "This address is blocked for new email reminders after an unsubscribe, spam complaint, or permanent delivery failure."}
              </p>
            </article>
          ))}
        </div>
      )}
    </AccountShell>
  );
}

function identityClass(status: "active" | "blocked"): string {
  return status === "active"
    ? (styles.active ?? "")
    : (styles.suppressed ?? "");
}

function identityLabel(status: "active" | "blocked"): string {
  return status === "active" ? "Active" : "Blocked";
}
