import { SiteHeader } from "../ui/SiteHeader";
import styles from "../features/information/InformationPage.module.css";
import type { Route } from "./+types/about";

export const meta: Route.MetaFunction = () => [
  { title: "About — Reminders.work" },
  {
    name: "description",
    content:
      "Learn how Reminders.work provides simple, privacy-conscious reminders for tasks, meetings, and deadlines.",
  },
];

export default function AboutRoute() {
  return (
    <main id="main-content" className={styles.shell}>
      <SiteHeader context="About" />
      <article className={styles.article}>
        <p className="eyebrow">Why this exists</p>
        <h1>Reminders without another app.</h1>
        <p>
          Reminders.work helps people schedule one-time and recurring reminders
          from a browser. It focuses on clear timing, explicit delivery choices,
          and simple management links.
        </p>
        <h2>How it works</h2>
        <p>
          You describe a task, review its exact local time, and choose email or
          browser delivery. Scheduling runs on Cloudflare infrastructure, while
          reminder content is encrypted at rest.
        </p>
        <h2>Recipient control</h2>
        <p>
          Every reminder email includes an unsubscribe path. A recipient’s
          unsubscribe, spam complaint, or permanent delivery failure blocks
          future email reminders to that address.
        </p>
        <h2>Independent service</h2>
        <p>
          Reminders.work is an independent utility and is not affiliated with
          Google, Microsoft, Apple, or Cloudflare.
        </p>
      </article>
    </main>
  );
}
