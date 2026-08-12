import type { ReactNode } from "react";
import { Form } from "react-router";

import type { DeliveryDestinationView } from "../../application/use-cases/delivery-destinations";
import { AccountShell } from "../features/account/AccountShell";
import styles from "../features/account/AccountWorkspace.module.css";
import { requireAuthenticatedUser } from "../require-auth.server";
import { applicationServicesContext } from "../server-context";
import type { Route } from "./+types/email-settings";

export const meta: Route.MetaFunction = () => [
  { title: "Delivery settings — Reminders.work" },
  { name: "robots", content: "noindex, nofollow" },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const services = context.get(applicationServicesContext);
  const user = await requireAuthenticatedUser(request, services);
  if (user instanceof Response) return user;
  const [emailResult, destinationResult] = await Promise.all([
    services.getEmailSettings(user.id),
    services.listDeliveryDestinations(user.id),
  ]);
  const url = new URL(request.url);
  return {
    emailResult,
    destinationResult,
    slackAvailable: services.slackAvailable,
    connectedMessage: url.searchParams.get("connected"),
    routeError: url.searchParams.get("error"),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const services = context.get(applicationServicesContext);
  const user = await requireAuthenticatedUser(request, services);
  if (user instanceof Response) return user;
  const form = await request.formData();
  const intent = form.get("intent");
  const identityIdValue = form.get("identityId");
  const identityId = typeof identityIdValue === "string" ? identityIdValue : "";
  const destinationIdValue = form.get("destinationId");
  const destinationId =
    typeof destinationIdValue === "string" ? destinationIdValue : "";
  if (intent === "forget") {
    return services.forgetSavedEmailRecipient(user.id, identityId);
  }
  if (intent === "create_webhook") {
    const stringField = (name: string) => {
      const value = form.get(name);
      return typeof value === "string" ? value : "";
    };
    return services.createWebhookDestination(user.id, {
      label: stringField("label"),
      url: stringField("url"),
      signingSecret: stringField("signingSecret"),
    });
  }
  if (intent === "test_destination") {
    return services.testDeliveryDestination(user.id, destinationId);
  }
  if (intent === "enable_destination" || intent === "disable_destination") {
    return services.setDeliveryDestinationEnabled(
      user.id,
      destinationId,
      intent === "enable_destination",
    );
  }
  if (intent === "delete_destination") {
    return services.deleteDeliveryDestination(user.id, destinationId);
  }
  return {
    ok: false as const,
    requestId: services.requestId,
    error: {
      code: "ACTION_INVALID",
      retryable: false,
      form: "Choose a valid delivery setting action.",
    },
  };
}

export default function EmailSettingsRoute({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const identities = loaderData.emailResult.ok
    ? loaderData.emailResult.data.identities
    : [];
  const destinations = loaderData.destinationResult.ok
    ? loaderData.destinationResult.data.destinations
    : [];
  const slackDestinations = destinations.filter(
    (destination) => destination.type === "slack",
  );
  const webhookDestinations = destinations.filter(
    (destination) => destination.type === "webhook",
  );

  return (
    <AccountShell>
      <p className="eyebrow">Account settings</p>
      <h1>Delivery</h1>
      <p className={styles.lede}>
        Manage where your reminders are sent: email recipients, Slack channels,
        and signed webhooks.
      </p>

      {loaderData.connectedMessage !== null ? (
        <p className={styles.feedback} role="status">
          {loaderData.connectedMessage}
        </p>
      ) : loaderData.routeError !== null ? (
        <p className={styles.error} role="alert">
          {loaderData.routeError}
        </p>
      ) : actionData?.ok === true ? (
        <p className={styles.feedback} role="status">
          {actionData.data.message}
        </p>
      ) : actionData?.ok === false ? (
        <p className={styles.error} role="alert">
          {actionData.error.form ?? "The saved address could not be changed."}
        </p>
      ) : !loaderData.emailResult.ok ? (
        <p className={styles.error} role="alert">
          {loaderData.emailResult.error.form ??
            "Saved delivery addresses could not be loaded."}
        </p>
      ) : null}

      <section className={styles.channelSection} aria-labelledby="email-title">
        <div className={styles.sectionHeading}>
          <p className="eyebrow">Personal delivery</p>
          <h2 id="email-title">Email recipients</h2>
          <p className={styles.lede}>
            Email addresses are saved when you create a reminder. Recipients can
            unsubscribe from any message they receive.
          </p>
        </div>

        {identities.length === 0 ? (
          <section className={styles.empty}>
            <h3>No saved email recipients</h3>
            <p className={styles.muted}>
              Recipients appear here after you create an email reminder.
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
                    <input
                      type="hidden"
                      name="identityId"
                      value={identity.id}
                    />
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
      </section>

      {!loaderData.destinationResult.ok ? (
        <p className={styles.error} role="alert">
          {loaderData.destinationResult.error.form ??
            "External destinations could not be loaded."}
        </p>
      ) : null}

      <DestinationSection
        eyebrow="Team delivery"
        title="Slack"
        description="Send reminders to a channel your team already follows. Each connection is tied to one Slack workspace and channel."
        destinations={slackDestinations}
        empty="No Slack channels connected yet."
        action={
          loaderData.slackAvailable ? (
            <a className={styles.primaryLink} href="/integrations/slack/start">
              Connect Slack channel
            </a>
          ) : (
            <span className={styles.disabledIntegration}>
              Slack connection awaits deployment credentials
            </span>
          )
        }
      />

      <DestinationSection
        eyebrow="Developer delivery"
        title="Webhooks"
        description="Post signed reminder events to your own automation or service. Credentials are encrypted and never displayed again."
        destinations={webhookDestinations}
        empty="No signed webhooks added yet."
      >
        <section className={styles.formCard}>
          <h3>Add signed webhook</h3>
          <p className={styles.muted}>
            We POST a fixed JSON envelope with timestamp, event, idempotency,
            and an HMAC-SHA256 signature. Only public HTTPS URLs are accepted.
          </p>
          <Form method="post" className={styles.webhookForm}>
            <div className={styles.field}>
              <label htmlFor="webhook-label">Label</label>
              <input
                id="webhook-label"
                name="label"
                maxLength={80}
                placeholder="Team automation"
                required
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="webhook-url">Webhook URL</label>
              <input
                id="webhook-url"
                name="url"
                type="url"
                placeholder="https://example.com/reminders"
                required
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="webhook-secret">Signing secret</label>
              <input
                id="webhook-secret"
                name="signingSecret"
                type="password"
                minLength={16}
                maxLength={200}
                autoComplete="new-password"
                required
              />
            </div>
            <button name="intent" value="create_webhook">
              Save webhook
            </button>
          </Form>
        </section>
      </DestinationSection>
    </AccountShell>
  );
}

function DestinationSection({
  eyebrow,
  title,
  description,
  destinations,
  empty,
  action,
  children,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly destinations: readonly DeliveryDestinationView[];
  readonly empty: string;
  readonly action?: ReactNode;
  readonly children?: ReactNode;
}) {
  const titleId = `${title.toLowerCase()}-title`;
  return (
    <section className={styles.channelSection} aria-labelledby={titleId}>
      <div className={styles.sectionHeadingRow}>
        <div className={styles.sectionHeading}>
          <p className="eyebrow">{eyebrow}</p>
          <h2 id={titleId}>{title}</h2>
          <p className={styles.lede}>{description}</p>
        </div>
        {action}
      </div>
      {destinations.length === 0 ? (
        <div className={styles.emptyCompact}>
          <p className={styles.muted}>{empty}</p>
        </div>
      ) : (
        <div className={styles.list}>
          {destinations.map((destination) => (
            <DestinationCard destination={destination} key={destination.id} />
          ))}
        </div>
      )}
      {children}
    </section>
  );
}

function DestinationCard({
  destination,
}: {
  readonly destination: DeliveryDestinationView;
}) {
  return (
    <article className={styles.identity}>
      <div>
        <div className={styles.identityHeading}>
          <h3>{destination.label}</h3>
          <span className={destinationClass(destination.status)}>
            {destination.status}
          </span>
        </div>
        <p className={styles.emailMeta}>{destination.detail}</p>
      </div>
      <div className={styles.actions}>
        <DestinationAction destination={destination} intent="test_destination">
          Send test
        </DestinationAction>
        <DestinationAction
          destination={destination}
          intent={
            destination.status === "disabled"
              ? "enable_destination"
              : "disable_destination"
          }
        >
          {destination.status === "disabled" ? "Enable" : "Pause"}
        </DestinationAction>
        <DestinationAction
          destination={destination}
          intent="delete_destination"
          danger
        >
          Remove
        </DestinationAction>
      </div>
      <p className={styles.identityNote}>
        {destination.lastSuccessAt === undefined
          ? "No successful delivery recorded yet."
          : `Last successful delivery ${new Date(destination.lastSuccessAt).toLocaleString()}.`}
        {destination.consecutiveFailures > 0
          ? ` ${String(destination.consecutiveFailures)} consecutive failure${destination.consecutiveFailures === 1 ? "" : "s"}.`
          : ""}
      </p>
    </article>
  );
}

function DestinationAction({
  destination,
  intent,
  danger = false,
  children,
}: {
  readonly destination: DeliveryDestinationView;
  readonly intent: string;
  readonly danger?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <Form method="post">
      <input type="hidden" name="destinationId" value={destination.id} />
      <button
        className={danger ? styles.dangerButton : styles.secondaryButton}
        name="intent"
        value={intent}
        disabled={
          intent === "test_destination" && destination.status === "disabled"
        }
      >
        {children}
      </button>
    </Form>
  );
}

function destinationClass(status: "active" | "failing" | "disabled"): string {
  return status === "active"
    ? (styles.active ?? "")
    : status === "failing"
      ? (styles.pending ?? "")
      : (styles.suppressed ?? "");
}

function identityClass(status: "active" | "blocked"): string {
  return status === "active"
    ? (styles.active ?? "")
    : (styles.suppressed ?? "");
}

function identityLabel(status: "active" | "blocked"): string {
  return status === "active" ? "Active" : "Blocked";
}
