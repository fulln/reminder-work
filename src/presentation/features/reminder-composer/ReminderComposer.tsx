import { Form, useNavigation } from "react-router";
import { useEffect, useRef } from "react";

import type { CreateReminderAccepted } from "../../../application/use-cases/create-reminder";
import type { ReviewedReminder } from "../../../application/use-cases/review-reminder";
import type { CapabilityPreset } from "../../../content/capability-presets";
import styles from "./ReminderComposer.module.css";
import { ActionButton } from "../../ui/ActionButton";

export type ComposerActionData =
  | {
      readonly stage: "input-error";
      readonly fields: Readonly<Record<string, readonly string[]>>;
      readonly values: Readonly<Record<string, string>>;
    }
  | { readonly stage: "review"; readonly reminder: ReviewedReminder }
  | {
      readonly stage: "create-error";
      readonly message: string;
      readonly fields?: Readonly<Record<string, readonly string[]>>;
      readonly values: Readonly<Record<string, string>>;
    }
  | {
      readonly stage: "created";
      readonly result: Omit<CreateReminderAccepted, "verificationToken"> & {
        readonly verificationToken?: string;
      };
    };

const zones = [
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
] as const;

function fieldValue(
  actionData: ComposerActionData | undefined,
  name: string,
): string {
  if (actionData?.stage === "review") {
    const field = actionData.reminder[name as keyof ReviewedReminder];
    return typeof field === "string" ? field : "";
  }
  if (
    actionData?.stage === "input-error" ||
    actionData?.stage === "create-error"
  ) {
    return actionData.values[name] ?? "";
  }
  return "";
}

function FieldError({
  actionData,
  name,
}: {
  readonly actionData?: ComposerActionData;
  readonly name: string;
}) {
  const errors =
    actionData?.stage === "input-error" || actionData?.stage === "create-error"
      ? actionData.fields?.[name]
      : undefined;
  if (errors === undefined) return null;
  return (
    <span className={styles.fieldError} id={`${name}-error`}>
      {errors.join(" ")}
    </span>
  );
}

function HiddenDraft({ reminder }: { readonly reminder: ReviewedReminder }) {
  return (
    <>
      <input type="hidden" name="schemaVersion" value="1" />
      <input type="hidden" name="title" value={reminder.title} />
      <input
        type="hidden"
        name="recipientEmail"
        value={reminder.recipientEmail}
      />
      <input type="hidden" name="localDate" value={reminder.localDate} />
      <input type="hidden" name="localTime" value={reminder.localTime} />
      <input type="hidden" name="timeZone" value={reminder.timeZone} />
      <input
        type="hidden"
        name="turnstileToken"
        value={reminder.turnstileToken}
      />
      {reminder.disambiguation === undefined ? null : (
        <input
          type="hidden"
          name="disambiguation"
          value={reminder.disambiguation}
        />
      )}
      {reminder.recurrence === null ||
      reminder.recurrence === undefined ? null : (
        <>
          <input
            type="hidden"
            name="recurrenceKind"
            value={reminder.recurrence.kind}
          />
          <input
            type="hidden"
            name="recurrenceInterval"
            value={reminder.recurrence.interval}
          />
        </>
      )}
      {reminder.leadOffsetsMinutes?.map((minutes) => (
        <input
          key={minutes}
          type="hidden"
          name="leadOffsetsMinutes"
          value={minutes}
        />
      ))}
    </>
  );
}

export function ReminderComposer({
  actionData,
  preset,
}: {
  readonly actionData?: ComposerActionData;
  readonly preset?: CapabilityPreset;
}) {
  const navigation = useNavigation();
  const pending = navigation.state !== "idle";
  const hasErrors =
    actionData?.stage === "input-error" || actionData?.stage === "create-error";
  const errorSummary = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasErrors) errorSummary.current?.focus();
  }, [hasErrors]);

  if (actionData?.stage === "created") {
    return (
      <section className={styles.result} aria-labelledby="verification-title">
        <p className={styles.step}>Reminder saved · Verification required</p>
        <h2 id="verification-title">Check your email</h2>
        <p>
          We prepared a verification message for{" "}
          <strong>{actionData.result.maskedRecipient}</strong>. The reminder
          will not become active until the address is verified.
        </p>
        {actionData.result.verificationToken === undefined ? null : (
          <>
            <a
              className={styles.previewLink}
              href={`/verify/${actionData.result.verificationToken}`}
            >
              Open local verification preview
            </a>
            <p className={styles.localNote}>
              This preview link is shown only by the local development flow.
            </p>
          </>
        )}
      </section>
    );
  }

  if (actionData?.stage === "review") {
    return (
      <section className={styles.review} aria-labelledby="review-title">
        <p className={styles.step}>Review exact time</p>
        <h2 id="review-title">Confirm this reminder</h2>
        <dl className={styles.reviewGrid}>
          <div>
            <dt>Reminder</dt>
            <dd>{actionData.reminder.title}</dd>
          </div>
          <div>
            <dt>Local time</dt>
            <dd className={styles.primaryTime}>
              {actionData.reminder.review.local}
            </dd>
          </div>
          <div>
            <dt>Time zone</dt>
            <dd>{actionData.reminder.review.timeZone}</dd>
          </div>
          <div>
            <dt>Universal time</dt>
            <dd>{actionData.reminder.review.utc}</dd>
          </div>
        </dl>
        <Form method="post" className={styles.confirmActions}>
          <HiddenDraft reminder={actionData.reminder} />
          <ActionButton
            name="intent"
            value="create"
            state={pending ? "pending" : "idle"}
            pendingLabel="Creating reminder…"
          >
            Create reminder
          </ActionButton>
          <button
            className={styles.secondaryButton}
            type="submit"
            name="intent"
            value="edit"
            disabled={pending}
          >
            Edit details
          </button>
        </Form>
      </section>
    );
  }

  return (
    <Form method="post" className={styles.form} noValidate>
      <input type="hidden" name="schemaVersion" value="1" />
      <input type="hidden" name="turnstileToken" value="test-pass" />
      {hasErrors ? (
        <div
          ref={errorSummary}
          className={styles.errorSummary}
          role="alert"
          tabIndex={-1}
        >
          <strong>Review the reminder details.</strong>
          <span>
            {actionData.stage === "create-error"
              ? actionData.message
              : "Each highlighted field explains what to change."}
          </span>
        </div>
      ) : null}

      <fieldset>
        <legend>01 · What</legend>
        <label htmlFor="title">Reminder</label>
        <input
          id="title"
          name="title"
          type="text"
          maxLength={160}
          required
          autoComplete="off"
          defaultValue={fieldValue(actionData, "title") || preset?.exampleTitle}
          aria-describedby="title-hint title-error"
          placeholder={preset?.exampleTitle ?? "Prepare the launch notes"}
        />
        <span id="title-hint" className={styles.hint}>
          Use a short action you will recognize immediately.
        </span>
        <FieldError actionData={actionData} name="title" />
      </fieldset>

      <fieldset>
        <legend>02 · When</legend>
        <div className={styles.dateTimeGrid}>
          <div>
            <label htmlFor="localDate">Date</label>
            <input
              id="localDate"
              name="localDate"
              type="date"
              required
              defaultValue={fieldValue(actionData, "localDate")}
              aria-describedby="localDate-error"
            />
            <FieldError actionData={actionData} name="localDate" />
          </div>
          <div>
            <label htmlFor="localTime">Time</label>
            <input
              id="localTime"
              name="localTime"
              type="time"
              required
              defaultValue={
                fieldValue(actionData, "localTime") ||
                preset?.defaults.localTime
              }
              aria-describedby="localTime-error"
            />
            <FieldError actionData={actionData} name="localTime" />
          </div>
        </div>
        <label htmlFor="timeZone">Time zone</label>
        <select
          id="timeZone"
          name="timeZone"
          required
          defaultValue={
            (fieldValue(actionData, "timeZone") || preset?.defaults.timeZone) ??
            "Asia/Shanghai"
          }
          aria-describedby="timeZone-hint timeZone-error"
        >
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
        <span id="timeZone-hint" className={styles.hint}>
          We keep the IANA zone so recurring reminders survive clock changes.
        </span>
        <FieldError actionData={actionData} name="timeZone" />
        {preset?.visibleOptions.includes("recurrence") === true ? (
          <>
            <label htmlFor="recurrenceKind">Repeat schedule</label>
            <select
              id="recurrenceKind"
              name="recurrenceKind"
              defaultValue={preset.defaults.recurrenceKind}
            >
              <option value="daily">Every day</option>
              <option value="weekly">Every week</option>
              <option value="monthly">Every month</option>
            </select>
            <input type="hidden" name="recurrenceInterval" value="1" />
          </>
        ) : null}
        {preset?.visibleOptions.some(
          (option) => option === "lead-time" || option === "lead-times",
        ) === true ? (
          <fieldset>
            <legend>Reminder lead times</legend>
            {[30, 1440, 10080].map((minutes) => (
              <label key={minutes}>
                <input
                  type="checkbox"
                  name="leadOffsetsMinutes"
                  value={minutes}
                  defaultChecked={preset.defaults.leadOffsetsMinutes.includes(
                    minutes,
                  )}
                />
                {minutes === 30
                  ? "30 minutes before"
                  : minutes === 1440
                    ? "1 day before"
                    : "7 days before"}
              </label>
            ))}
          </fieldset>
        ) : null}
        {preset?.visibleOptions.includes("acknowledgement") === true ? (
          <p className={styles.hint}>
            The secure reminder link includes Done, Snooze, Reschedule, and
            Cancel.
          </p>
        ) : null}
      </fieldset>

      <fieldset>
        <legend>03 · Who</legend>
        <label htmlFor="recipientEmail">Email address</label>
        <input
          id="recipientEmail"
          name="recipientEmail"
          type="email"
          required
          autoComplete="email"
          defaultValue={fieldValue(actionData, "recipientEmail")}
          aria-describedby="recipientEmail-hint recipientEmail-error"
          placeholder="you@example.com"
        />
        <span id="recipientEmail-hint" className={styles.hint}>
          We send nothing until this address is verified.
        </span>
        <FieldError actionData={actionData} name="recipientEmail" />
      </fieldset>

      <ActionButton
        name="intent"
        value="review"
        state={pending ? "pending" : "idle"}
        pendingLabel="Resolving exact time…"
      >
        Review reminder
      </ActionButton>
    </Form>
  );
}
