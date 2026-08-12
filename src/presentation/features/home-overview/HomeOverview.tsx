import { useRouteLoaderData } from "react-router";

import type { loader as rootLoader } from "../../root";
import styles from "./HomeOverview.module.css";

const capabilities = [
  {
    href: "/online-reminder",
    title: "One-time reminders",
    description: "Pick an exact local date and time without installing an app.",
  },
  {
    href: "/recurring-reminder",
    title: "Recurring schedules",
    description:
      "Repeat daily, weekly, or monthly with daylight-saving safety.",
  },
  {
    href: "/email-reminder",
    title: "Direct email delivery",
    description: "Send to a saved address even when the browser is closed.",
  },
  {
    href: "/meeting-reminder",
    title: "Meeting preparation",
    description: "Return to an agenda or follow-up at the moment it matters.",
  },
  {
    href: "/deadline-reminder",
    title: "Deadline lead times",
    description: "Add advance alerts before a due date becomes urgent.",
  },
  {
    href: "/follow-up-reminder",
    title: "Follow-up reminders",
    description:
      "Keep promises and handoffs from disappearing after a meeting.",
  },
] as const;

const steps = [
  {
    number: "01",
    title: "Describe it",
    description: "Use a sentence or enter the schedule manually.",
  },
  {
    number: "02",
    title: "Review the instant",
    description: "Confirm local time, time zone, recurrence, and delivery.",
  },
  {
    number: "03",
    title: "Receive it",
    description: "Use email, this browser, or both where available.",
  },
  {
    number: "04",
    title: "Stay in control",
    description: "Complete, snooze, reschedule, cancel, or unsubscribe.",
  },
] as const;

export function HomeOverview() {
  const rootData = useRouteLoaderData<typeof rootLoader>("root");
  const user = rootData?.user ?? null;
  const workspaceHref =
    user === null ? (rootData?.authLoginUrl ?? "/auth/login") : "/reminders";

  return (
    <div className={styles.overview}>
      <section
        className={styles.productSection}
        id="features"
        aria-labelledby="features-title"
      >
        <div className={styles.sectionHeading}>
          <p className="eyebrow">The whole system</p>
          <h2 id="features-title">Remember the work. Control the delivery.</h2>
          <p>
            Reminders.work brings scheduling and email delivery into one small,
            understandable workspace.
          </p>
        </div>

        <div className={styles.productGrid}>
          <article className={styles.productCard}>
            <p className={styles.cardNumber}>01 · REMINDERS</p>
            <h3>Plan what happens next.</h3>
            <p>
              Create one-time or repeating reminders, see everything attached to
              your account, and act from a secure management link.
            </p>
            <ul>
              <li>Natural-language or manual scheduling</li>
              <li>Complete, snooze, reschedule, and cancel</li>
              <li>Exact time-zone and calendar handoff</li>
            </ul>
            <a href="/reminders">View reminder management</a>
          </article>

          <article
            className={`${styles.productCard ?? ""} ${styles.deliveryCard ?? ""}`}
          >
            <p className={styles.cardNumber}>02 · EMAIL &amp; DELIVERY</p>
            <h3>Know where reminders can go.</h3>
            <p>
              Reuse saved delivery addresses and see whether an address is
              active or blocked without turning the site into an inbox.
            </p>
            <ul>
              <li>Direct email and browser notification delivery</li>
              <li>Saved addresses with active reminder counts</li>
              <li>Recipient unsubscribe, bounce, and complaint protection</li>
            </ul>
            <a href="/settings/email">View email &amp; delivery</a>
          </article>
        </div>
      </section>

      <section
        className={styles.flowSection}
        id="how-it-works"
        aria-labelledby="flow-title"
      >
        <div className={styles.sectionHeading}>
          <p className="eyebrow">From thought to done</p>
          <h2 id="flow-title">Four clear steps. No hidden timing.</h2>
        </div>
        <ol className={styles.steps}>
          {steps.map((step) => (
            <li key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.useCases} aria-labelledby="use-cases-title">
        <div className={styles.sectionHeading}>
          <p className="eyebrow">Built for real work</p>
          <h2 id="use-cases-title">One tool for every kind of return.</h2>
        </div>
        <div className={styles.capabilityGrid}>
          {capabilities.map((capability) => (
            <a href={capability.href} key={capability.href}>
              <h3>{capability.title}</h3>
              <p>{capability.description}</p>
              <span aria-hidden="true">Explore →</span>
            </a>
          ))}
        </div>
      </section>

      <section
        className={styles.trustSection}
        id="delivery"
        aria-labelledby="delivery-title"
      >
        <div>
          <p className="eyebrow">Recipient control by design</p>
          <h2 id="delivery-title">Delivery should never become pressure.</h2>
        </div>
        <div className={styles.trustCopy}>
          <p>
            Every email includes an unsubscribe path. Permanent bounces and spam
            complaints block future delivery to that address, and reminder
            content stays encrypted at rest.
          </p>
          <div className={styles.trustLinks}>
            <a href="/about">How Reminders.work operates</a>
            <a href="/privacy">Read the privacy notice</a>
          </div>
        </div>
      </section>

      <section className={styles.finalCta} aria-labelledby="cta-title">
        <p className="eyebrow">Ready when you are</p>
        <h2 id="cta-title">Put the next thing in motion.</h2>
        <p>
          Create without an account, or sign in to keep every reminder together.
        </p>
        <div>
          <a className={styles.primaryAction} href="#main-content">
            Create a reminder
          </a>
          <a className={styles.secondaryAction} href={workspaceHref}>
            Open your workspace
          </a>
        </div>
      </section>
    </div>
  );
}
