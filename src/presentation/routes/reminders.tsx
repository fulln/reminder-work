import { useState } from "react";
import { Link } from "react-router";

import { AccountShell } from "../features/account/AccountShell";
import type { ReminderSchedule } from "../../domain/reminder/schedule";
import styles from "../features/account/AccountWorkspace.module.css";
import type { ComposerActionData } from "../features/reminder-composer/ReminderComposer";
import { ReminderComposer } from "../features/reminder-composer/ReminderComposer";
import { handleComposerAction } from "../features/reminder-composer/composer-action.server";
import { requireAuthenticatedUser } from "../require-auth.server";
import { applicationServicesContext } from "../server-context";
import type { Route } from "./+types/reminders";

export const meta: Route.MetaFunction = () => [
  { title: "Your reminders — Reminders.work" },
  { name: "robots", content: "noindex, nofollow" },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const services = context.get(applicationServicesContext);
  const user = await requireAuthenticatedUser(request, services);
  if (user instanceof Response) return user;
  return services.listOwnedReminders(user.id);
}

export async function action({ request, context }: Route.ActionArgs) {
  const services = context.get(applicationServicesContext);
  const user = await requireAuthenticatedUser(request, services);
  if (user instanceof Response) return user;
  return handleComposerAction(await request.formData(), services, user.id);
}

export default function RemindersRoute({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const composerActionData = actionData as ComposerActionData | undefined;
  const [composerOpen, setComposerOpen] = useState(
    composerActionData !== undefined,
  );

  return (
    <AccountShell>
      <div className={styles.headingRow}>
        <div>
          <p className="eyebrow">Reminder management</p>
          <h1>Your reminders</h1>
          <p className={styles.lede}>
            Everything scheduled, waiting for verification, or recently
            completed.
          </p>
        </div>
        <button
          className={styles.primaryLink}
          type="button"
          aria-expanded={composerOpen}
          aria-controls="new-reminder"
          onClick={() => {
            setComposerOpen((open) => !open);
          }}
        >
          {composerOpen ? "Close creator" : "New reminder"}
        </button>
      </div>

      {composerOpen ? (
        <section
          className={styles.composerPanel}
          id="new-reminder"
          aria-labelledby="new-reminder-title"
        >
          <div className={styles.composerPanelHeading}>
            <div>
              <p className="eyebrow">Create here</p>
              <h2 id="new-reminder-title">New reminder</h2>
            </div>
            <p className={styles.muted}>
              It will appear in this list as soon as it is created.
            </p>
          </div>
          <ReminderComposer actionData={composerActionData} />
        </section>
      ) : null}

      {!loaderData.ok ? (
        <p className={styles.error} role="alert">
          {loaderData.error.form ?? "Your reminders could not be loaded."}
        </p>
      ) : loaderData.data.items.length === 0 ? (
        <section className={styles.empty}>
          <h2>No reminders yet</h2>
          <p className={styles.muted}>
            New reminders created while signed in will appear here.
          </p>
        </section>
      ) : (
        <div className={styles.list}>
          {loaderData.data.items.map((reminder) => (
            <article className={styles.reminder} key={reminder.id}>
              <span
                className={`${styles.status ?? ""} ${statusClass(reminder.status)}`}
              >
                {statusLabel(reminder.status)}
              </span>
              <div>
                <h2>{reminder.title}</h2>
                <p className={styles.reminderMeta}>
                  {formatSchedule(reminder.schedule)}
                </p>
                <span className={styles.delivery}>
                  {reminder.deliveryLabel} · {reminder.maskedRecipient}
                </span>
              </div>
              <Link
                className={styles.manageLink}
                to={`/reminders/${encodeURIComponent(reminder.id)}`}
              >
                Manage
              </Link>
            </article>
          ))}
        </div>
      )}
    </AccountShell>
  );
}

function statusLabel(status: string): string {
  return status === "pending_verification"
    ? "Email pending"
    : status.charAt(0).toUpperCase() + status.slice(1);
}

function formatSchedule(schedule: ReminderSchedule): string {
  return `${new Date(schedule.resolvedUtc).toLocaleString("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: schedule.timeZone,
  })} · ${schedule.timeZone}`;
}

function statusClass(status: string): string {
  if (status === "active" || status === "snoozed") return styles.active ?? "";
  if (status === "pending_verification") return styles.pending ?? "";
  return styles.terminal ?? "";
}
