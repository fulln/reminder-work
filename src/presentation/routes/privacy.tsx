import { SiteHeader } from "../ui/SiteHeader";
import styles from "../features/information/InformationPage.module.css";
import type { Route } from "./+types/privacy";

export const meta: Route.MetaFunction = () => [
  { title: "Privacy — Reminders.work" },
  {
    name: "description",
    content:
      "How Reminders.work handles reminder data, authentication, delivery, and advertising.",
  },
];

export default function PrivacyRoute() {
  return (
    <main id="main-content" className={styles.shell}>
      <SiteHeader context="Privacy" />
      <article className={styles.article}>
        <p className="eyebrow">Privacy notice</p>
        <h1>Your reminders are not advertising data.</h1>
        <p className={styles.updated}>Last updated: August 12, 2026</p>
        <p>
          Reminders.work processes the information needed to schedule and
          deliver reminders. Reminder titles and recipient addresses are
          encrypted at rest and are not sold to advertisers.
        </p>
        <h2>Information we process</h2>
        <ul>
          <li>Reminder text, schedule, time zone, and delivery destination.</li>
          <li>Opaque account sessions when you choose to sign in.</li>
          <li>
            Abuse-prevention signals and privacy-preserving rate-limit keys.
          </li>
          <li>
            Delivery outcomes such as permanent bounces and spam complaints.
          </li>
          <li>
            Encrypted Slack and webhook destination credentials when an account
            owner chooses to connect them.
          </li>
        </ul>
        <h2>Service providers</h2>
        <p>
          Cloudflare provides hosting, storage, bot protection, queues, and
          email delivery. Google and GitHub may process account information when
          you choose their sign-in options. Slack processes reminder content
          sent to a connected Slack channel. A webhook operator receives the
          reminder content you explicitly route to its endpoint.
        </p>
        <h2>Advertising</h2>
        <p>
          Selected public information pages may load Google AdSense. Google and
          its partners may use cookies or similar technologies to deliver,
          measure, and personalize ads where permitted. Advertising code is not
          loaded on reminder management, email settings, verification,
          unsubscribe, authentication, or calendar pages.
        </p>
        <p>
          Where required, a consent message lets you accept, reject, or manage
          advertising choices. You can also review Google’s information about{" "}
          <a href="https://policies.google.com/technologies/partner-sites">
            how it uses data from sites that use its services
          </a>
          .
        </p>
        <h2>Recipient choices</h2>
        <p>
          Every reminder email includes an unsubscribe link. Unsubscribes,
          permanent bounces, and spam complaints are retained as suppression
          records so the address is not contacted again.
        </p>
        <h2>Contact</h2>
        <p>
          For access, deletion, privacy, or abuse requests, email{" "}
          <a href="mailto:support@reminders.work">support@reminders.work</a>.
        </p>
      </article>
    </main>
  );
}
