import { Form } from "react-router";

import type { ReminderView } from "../../../application/use-cases/get-reminder-view";
import { TimeRail } from "../../ui/TimeRail";
import { ActionButton } from "../../ui/ActionButton";
import styles from "./ReminderManagement.module.css";

export function ReminderManagement({ view }: { readonly view: ReminderView }) {
  const terminal = view.actions.length === 0;
  return (
    <main id="main-content" className={styles.shell}>
      <p className="eyebrow">Secure reminder link</p>
      <span className={styles.state}>{label(view.status)}</span>
      <h1>{view.title}</h1>
      <TimeRail
        activeStep={view.status === "completed" ? "completed" : "scheduled"}
      />
      <p className={styles.time}>
        {new Date(view.schedule.resolvedUtc).toLocaleString("en", {
          dateStyle: "full",
          timeStyle: "short",
          timeZone: view.schedule.timeZone,
        })}{" "}
        · {view.schedule.timeZone}
      </p>
      {view.deliveryLabel === undefined ? null : (
        <section className={styles.delivery} aria-labelledby="delivery-title">
          <div>
            <h2 id="delivery-title">Delivery</h2>
            <p>
              {view.deliveryLabel}
              {view.maskedRecipient === undefined
                ? ""
                : ` · ${view.maskedRecipient}`}
            </p>
          </div>
          <span>
            {view.status === "pending_verification"
              ? "Pending"
              : view.status === "active" || view.status === "snoozed"
                ? "Ready"
                : "Inactive"}
          </span>
        </section>
      )}
      {terminal ? (
        <p>No further delivery actions are available for this reminder.</p>
      ) : (
        <div className={styles.actions} aria-label="Reminder actions">
          <ActionForm
            action="complete"
            version={view.version}
            label="Mark done"
          />
          <Form method="post">
            <input type="hidden" name="intent" value="snooze" />
            <input type="hidden" name="version" value={view.version} />
            <label>
              Snooze
              <select name="minutes" defaultValue="60">
                <option value="15">15 minutes</option>
                <option value="60">1 hour</option>
                <option value="1440">Tomorrow</option>
              </select>
            </label>
            <ActionButton>Snooze reminder</ActionButton>
          </Form>
          <Form method="post">
            <input type="hidden" name="intent" value="reschedule" />
            <input type="hidden" name="version" value={view.version} />
            <label>
              New date and time
              <input name="dateTime" type="datetime-local" required />
            </label>
            <ActionButton>Reschedule</ActionButton>
          </Form>
          <ActionForm
            action="cancel"
            version={view.version}
            label="Cancel reminder"
          />
        </div>
      )}
    </main>
  );
}

function ActionForm({
  action,
  version,
  label,
}: {
  action: "complete" | "cancel";
  version: number;
  label: string;
}) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value={action} />
      <input type="hidden" name="version" value={version} />
      <ActionButton variant={action === "cancel" ? "danger" : "primary"}>
        {label}
      </ActionButton>
    </Form>
  );
}

function label(status: ReminderView["status"]): string {
  return status === "pending_verification"
    ? "Pending verification"
    : status.charAt(0).toUpperCase() + status.slice(1);
}
