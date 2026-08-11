import { Form, useNavigation, useRouteLoaderData } from "react-router";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import type { CreateReminderAccepted } from "../../../application/use-cases/create-reminder";
import type { ReviewedReminder } from "../../../application/use-cases/review-reminder";
import type { CapabilityPreset } from "../../../content/capability-presets";
import { parseReminderText } from "../../../domain/reminder/parse-reminder-text";
import type { RecurrenceRule } from "../../../domain/reminder/schedule";
import type { DeliveryMode } from "../../../domain/reminder/delivery-plan";
import styles from "./ReminderComposer.module.css";
import { ActionButton } from "../../ui/ActionButton";
import type { loader as rootLoader } from "../../root";
import { TurnstileField } from "./TurnstileField";
import { WebPushField } from "./WebPushField";

type PendingCreatedResult = Omit<
  Extract<CreateReminderAccepted, { readonly state: "pending_verification" }>,
  "verificationToken"
> & { readonly verificationToken?: string };

type ComposerCreatedResult =
  | PendingCreatedResult
  | Extract<CreateReminderAccepted, { readonly state: "active" }>;

export type ComposerActionData =
  | {
      readonly stage: "input-error";
      readonly fields: Readonly<Record<string, readonly string[]>>;
      readonly values: Readonly<Record<string, string>>;
    }
  | {
      readonly stage: "review";
      readonly reminder: ReviewedReminder;
      readonly securityError?: readonly string[];
    }
  | {
      readonly stage: "create-error";
      readonly message: string;
      readonly fields?: Readonly<Record<string, readonly string[]>>;
      readonly values: Readonly<Record<string, string>>;
    }
  | {
      readonly stage: "created";
      readonly result: ComposerCreatedResult;
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

const weekdayNames = [
  "",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

function fieldValue(
  actionData: ComposerActionData | undefined,
  name: string,
): string {
  if (actionData?.stage === "review") {
    const field = actionData.reminder[name as keyof ReviewedReminder];
    if (name === "pushSubscription" && field !== undefined) {
      return JSON.stringify(field);
    }
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

function RecurrenceDraftFields({
  recurrence,
}: {
  readonly recurrence?: RecurrenceRule | null;
}) {
  if (recurrence === null || recurrence === undefined) return null;
  return (
    <>
      <input type="hidden" name="recurrenceKind" value={recurrence.kind} />
      <input
        type="hidden"
        name="recurrenceInterval"
        value={recurrence.interval}
      />
      {recurrence.kind === "weekly"
        ? recurrence.weekdays.map((weekday) => (
            <input
              key={weekday}
              type="hidden"
              name="recurrenceWeekdays"
              value={weekday}
            />
          ))
        : null}
      {recurrence.kind === "monthly" ? (
        <input
          type="hidden"
          name="recurrenceDayOfMonth"
          value={recurrence.dayOfMonth}
        />
      ) : null}
    </>
  );
}

function recurrenceLabel(recurrence: RecurrenceRule | null): string {
  if (recurrence === null) return "Does not repeat";
  if (recurrence.kind === "daily") return "Every day";
  if (recurrence.kind === "monthly") {
    return `Every month on day ${String(recurrence.dayOfMonth)}`;
  }
  if (recurrence.weekdays.length === 5) return "Every weekday";
  const weekday = recurrence.weekdays[0];
  const weekdayName = weekday === undefined ? undefined : weekdayNames[weekday];
  return weekdayName === undefined ? "Every week" : `Every ${weekdayName}`;
}

function setFormValue(
  form: HTMLFormElement,
  name: string,
  value: string,
): void {
  const control = form.elements.namedItem(name);
  if (
    control instanceof HTMLInputElement ||
    control instanceof HTMLSelectElement
  ) {
    control.value = value;
  }
}

function HiddenDraft({ reminder }: { readonly reminder: ReviewedReminder }) {
  return (
    <>
      <input type="hidden" name="schemaVersion" value="1" />
      <input type="hidden" name="title" value={reminder.title} />
      <input type="hidden" name="deliveryMode" value={reminder.deliveryMode} />
      {reminder.recipientEmail === undefined ? null : (
        <input
          type="hidden"
          name="recipientEmail"
          value={reminder.recipientEmail}
        />
      )}
      {reminder.pushSubscription === undefined ? null : (
        <input
          type="hidden"
          name="pushSubscription"
          value={JSON.stringify(reminder.pushSubscription)}
        />
      )}
      <input type="hidden" name="localDate" value={reminder.localDate} />
      <input type="hidden" name="localTime" value={reminder.localTime} />
      <input type="hidden" name="timeZone" value={reminder.timeZone} />
      {reminder.disambiguation === undefined ? null : (
        <input
          type="hidden"
          name="disambiguation"
          value={reminder.disambiguation}
        />
      )}
      {reminder.recurrence === null ||
      reminder.recurrence === undefined ? null : (
        <RecurrenceDraftFields recurrence={reminder.recurrence} />
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
  const rootData = useRouteLoaderData<typeof rootLoader>("root");
  const pending = navigation.state !== "idle";
  const hasErrors =
    actionData?.stage === "input-error" || actionData?.stage === "create-error";
  const errorSummary = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  const [manualExpanded, setManualExpanded] = useState(
    preset !== undefined || hasErrors,
  );
  const [quickText, setQuickText] = useState("");
  const [quickError, setQuickError] = useState<string | null>(null);
  const initialDeliveryMode = (() => {
    const value = fieldValue(actionData, "deliveryMode");
    return value === "web_push" || value === "web_push_email_fallback"
      ? value
      : "email";
  })();
  const [emailSelected, setEmailSelected] = useState(
    initialDeliveryMode !== "web_push",
  );
  const [browserSelected, setBrowserSelected] = useState(
    initialDeliveryMode !== "email",
  );
  const deliveryMode: DeliveryMode = emailSelected
    ? browserSelected
      ? "web_push_email_fallback"
      : "email"
    : "web_push";
  const [hydrated, setHydrated] = useState(false);
  const [parsedReminder, setParsedReminder] = useState<{
    readonly title: string;
    readonly localDate: string;
    readonly localTime: string;
    readonly timeZone: string;
    readonly recurrence: RecurrenceRule | null;
  } | null>(null);

  useEffect(() => {
    if (hasErrors) errorSummary.current?.focus();
  }, [hasErrors]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setHydrated(true);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (preset !== undefined || fieldValue(actionData, "timeZone") !== "") {
      return;
    }
    const form = formRef.current;
    const control = form?.elements.namedItem("timeZone");
    if (!(control instanceof HTMLSelectElement)) return;
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected === "") return;
    if (![...control.options].some((option) => option.value === detected)) {
      control.add(new Option(detected, detected));
    }
    control.value = detected;
  }, [actionData, preset]);

  const manualFieldsExpanded =
    preset !== undefined || hasErrors || manualExpanded;

  const readyForDelivery =
    preset !== undefined ||
    hasErrors ||
    manualExpanded ||
    parsedReminder !== null;

  function applyQuickReminder(timeZoneOverride?: string): void {
    const form = formRef.current;
    if (form === null) return;
    const timeZoneControl = form.elements.namedItem("timeZone");
    const timeZone =
      timeZoneOverride ??
      (timeZoneControl instanceof HTMLSelectElement
        ? timeZoneControl.value
        : "UTC");
    const result = parseReminderText(quickText, {
      now: new Date().toISOString(),
      timeZone,
    });
    if (!result.ok) {
      setParsedReminder(null);
      setQuickError(result.message);
      return;
    }

    setFormValue(form, "title", result.value.title);
    setFormValue(form, "localDate", result.value.localDate);
    setFormValue(form, "localTime", result.value.localTime);
    setParsedReminder(result.value);
    setQuickError(null);
    setManualExpanded(false);
    setScheduleExpanded(false);
  }

  function handleQuickKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applyQuickReminder();
  }

  if (actionData?.stage === "created") {
    if (actionData.result.state === "active") {
      return (
        <section className={styles.result} aria-labelledby="active-title">
          <p className={styles.step}>Reminder active · Browser delivery</p>
          <h2 id="active-title">This browser will remind you</h2>
          <p>
            The reminder is scheduled. A system notification will open its
            secure management page when it is due.
          </p>
          <a
            className={styles.previewLink}
            href={`/manage/${actionData.result.manageToken}`}
          >
            Manage reminder
          </a>
        </section>
      );
    }
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
          <div>
            <dt>Delivery</dt>
            <dd>
              {actionData.reminder.deliveryMode === "email"
                ? "Email"
                : actionData.reminder.deliveryMode === "web_push"
                  ? "Browser notification"
                  : "Browser notification · Email backup"}
            </dd>
          </div>
          {actionData.reminder.recurrence === null ||
          actionData.reminder.recurrence === undefined ? null : (
            <div>
              <dt>Repeats</dt>
              <dd>{recurrenceLabel(actionData.reminder.recurrence)}</dd>
            </div>
          )}
        </dl>
        <Form method="post" className={styles.reviewForm}>
          <HiddenDraft reminder={actionData.reminder} />
          <TurnstileField
            siteKey={rootData?.turnstileSiteKey ?? ""}
            useLocalBypass={rootData?.useLocalTurnstileBypass === true}
            fieldError={actionData.securityError}
          />
          <div className={styles.confirmActions}>
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
          </div>
        </Form>
      </section>
    );
  }

  return (
    <Form
      ref={formRef}
      method="post"
      className={styles.form}
      data-ready={readyForDelivery}
      noValidate
    >
      <input type="hidden" name="schemaVersion" value="1" />
      <RecurrenceDraftFields recurrence={parsedReminder?.recurrence} />
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

      {preset === undefined && !manualExpanded ? (
        <fieldset
          className={[styles.sectionField, styles.quickSection].join(" ")}
        >
          <legend>01 · Quick create</legend>
          <label htmlFor="quickReminder">
            What should we remind you about?
          </label>
          <input
            id="quickReminder"
            name="quickReminder"
            type="text"
            disabled={!hydrated}
            autoComplete="off"
            value={quickText}
            onChange={(event) => {
              setQuickText(event.target.value);
              setQuickError(null);
              setParsedReminder(null);
            }}
            onKeyDown={handleQuickKeyDown}
            aria-describedby="quickReminder-hint quickReminder-error"
            aria-invalid={quickError === null ? undefined : true}
            placeholder="Remind me to send the report tomorrow at 9am"
          />
          <span id="quickReminder-hint" className={styles.hint}>
            Try “in 30 minutes”, “next Monday”, or “every weekday at 9am”.
          </span>
          {quickError === null ? null : (
            <span
              className={styles.fieldError}
              id="quickReminder-error"
              role="alert"
            >
              {quickError}
            </span>
          )}
          <button
            type="button"
            className={styles.quickButton}
            onClick={() => {
              applyQuickReminder();
            }}
            disabled={!hydrated}
          >
            Set date &amp; time
          </button>
        </fieldset>
      ) : null}

      {parsedReminder === null || manualExpanded ? null : (
        <section className={styles.parsedPreview} aria-live="polite">
          <span className={styles.parsedMarker}>Understood</span>
          <strong>{parsedReminder.title}</strong>
          <span>
            {parsedReminder.localDate} · {parsedReminder.localTime} ·{" "}
            {parsedReminder.timeZone}
          </span>
          <span>{recurrenceLabel(parsedReminder.recurrence)}</span>
        </section>
      )}

      {preset === undefined ? (
        <button
          className={styles.manualToggle}
          type="button"
          aria-controls="manual-reminder-fields"
          aria-expanded={manualExpanded}
          disabled={!hydrated}
          onClick={() => {
            if (manualExpanded) {
              setManualExpanded(false);
              return;
            }
            setParsedReminder(null);
            setQuickError(null);
            setManualExpanded(true);
          }}
        >
          {manualExpanded ? "Use quick create" : "Choose date & time manually"}
        </button>
      ) : null}

      <div
        className={styles.manualFields}
        id="manual-reminder-fields"
        data-expanded={manualFieldsExpanded}
      >
        <fieldset
          className={[styles.sectionField, styles.whatSection].join(" ")}
        >
          <legend>01 · What</legend>
          <label htmlFor="title">Reminder</label>
          <input
            id="title"
            name="title"
            type="text"
            maxLength={160}
            required
            autoComplete="off"
            defaultValue={
              fieldValue(actionData, "title") || preset?.exampleTitle
            }
            aria-describedby="title-hint title-error"
            placeholder={preset?.exampleTitle ?? "Prepare the launch notes"}
          />
          <span id="title-hint" className={styles.hint}>
            Use a short action you will recognize immediately.
          </span>
          <FieldError actionData={actionData} name="title" />
        </fieldset>

        <fieldset
          className={[styles.sectionField, styles.whenSection].join(" ")}
        >
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
        </fieldset>
      </div>

      {readyForDelivery ? (
        <fieldset
          className={[styles.sectionField, styles.whoSection].join(" ")}
        >
          <legend>
            {preset === undefined && !manualFieldsExpanded ? "02" : "03"} ·
            Delivery
          </legend>
          <div className={styles.deliveryChoices}>
            <div className={styles.deliveryChoice}>
              <label
                className={styles.deliveryChoiceHeader}
                htmlFor="delivery-email"
              >
                <input
                  id="delivery-email"
                  type="checkbox"
                  checked={emailSelected}
                  onChange={(event) => {
                    if (!event.target.checked && !browserSelected) return;
                    setEmailSelected(event.target.checked);
                  }}
                />
                <span>
                  <strong>Email</strong>
                  <small>
                    {browserSelected
                      ? "Backup when browser delivery is unavailable"
                      : "Reliable, even when the browser is closed"}
                  </small>
                </span>
              </label>
              {emailSelected ? (
                <div className={styles.deliveryChoiceBody}>
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
                </div>
              ) : null}
            </div>

            <div className={styles.deliveryChoice}>
              <label
                className={styles.deliveryChoiceHeader}
                htmlFor="delivery-browser"
              >
                <input
                  id="delivery-browser"
                  type="checkbox"
                  checked={browserSelected}
                  onChange={(event) => {
                    if (!event.target.checked && !emailSelected) return;
                    setBrowserSelected(event.target.checked);
                  }}
                />
                <span>
                  <strong>This browser</strong>
                  <small>System notification on this device</small>
                </span>
              </label>
              {browserSelected ? (
                <div className={styles.deliveryChoiceBody}>
                  <WebPushField
                    publicKey={rootData?.vapidPublicKey ?? ""}
                    initialSubscription={fieldValue(
                      actionData,
                      "pushSubscription",
                    )}
                    fieldError={
                      actionData?.stage === "input-error" ||
                      actionData?.stage === "create-error"
                        ? actionData.fields?.pushSubscription
                        : undefined
                    }
                  />
                </div>
              ) : null}
            </div>
          </div>
          <input type="hidden" name="deliveryMode" value={deliveryMode} />
        </fieldset>
      ) : null}

      <div
        className={styles.scheduleOptions}
        data-expanded={scheduleExpanded}
        data-ready={readyForDelivery}
      >
        <button
          className={styles.optionsToggle}
          type="button"
          aria-controls="schedule-options"
          aria-expanded={scheduleExpanded}
          onClick={() => {
            setScheduleExpanded((expanded) => !expanded);
          }}
        >
          <span className={styles.summaryTitle}>Schedule details</span>
          <span className={styles.summaryMeta}>Time zone &amp; options</span>
        </button>
        <div className={styles.optionsBody} id="schedule-options">
          <label htmlFor="timeZone">Time zone</label>
          <select
            id="timeZone"
            name="timeZone"
            required
            defaultValue={
              (fieldValue(actionData, "timeZone") ||
                preset?.defaults.timeZone) ??
              "Asia/Shanghai"
            }
            onChange={(event) => {
              if (parsedReminder !== null) {
                applyQuickReminder(event.target.value);
              }
            }}
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
            <fieldset className={styles.leadTimes}>
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
        </div>
      </div>

      {readyForDelivery ? (
        <div className={styles.submitDock}>
          <ActionButton
            name="intent"
            value="review"
            state={pending ? "pending" : "idle"}
            pendingLabel="Resolving exact time…"
          >
            Review reminder
          </ActionButton>
        </div>
      ) : null}
    </Form>
  );
}
