import { SiteHeader } from "../ui/SiteHeader";
import styles from "../features/information/InformationPage.module.css";
import type { Route } from "./+types/contact";

export const meta: Route.MetaFunction = () => [
  { title: "Contact — Reminders.work" },
  {
    name: "description",
    content: "Contact Reminders.work about support, privacy, or abuse.",
  },
];

export default function ContactRoute() {
  return (
    <main id="main-content" className={styles.shell}>
      <SiteHeader context="Contact" />
      <article className={styles.article}>
        <p className="eyebrow">Get in touch</p>
        <h1>Contact Reminders.work</h1>
        <p>
          For product support, privacy requests, delivery concerns, or abuse
          reports, email{" "}
          <a href="mailto:support@reminders.work">support@reminders.work</a>.
        </p>
        <h2>Include useful context</h2>
        <p>
          Share the page you were using, what you expected, and the approximate
          time of the issue. Do not send passwords, authentication tokens, or
          full reminder links.
        </p>
        <h2>Unwanted reminders</h2>
        <p>
          Use the unsubscribe link in the reminder email first. That action
          blocks future reminder email delivery to the same address.
        </p>
      </article>
    </main>
  );
}
