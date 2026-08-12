import { Form, useNavigation, useRouteLoaderData } from "react-router";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import type { CreateReminderAccepted } from "../../../application/use-cases/create-reminder";
import type { CalendarExportData } from "../../../application/contracts/calendar-export";
import { exportReminderCalendar } from "../../../application/use-cases/export-calendar";
import type { ReviewedReminder } from "../../../application/use-cases/review-reminder";
import {
  interpretReminderText,
  type ReminderInterpretationSource,
} from "../../../application/use-cases/interpret-reminder-text";
import type { CapabilityPreset } from "../../../content/capability-presets";
import type { RecurrenceRule } from "../../../domain/reminder/schedule";
import type { DeliveryMode } from "../../../domain/reminder/delivery-plan";
import styles from "./ReminderComposer.module.css";
import { ActionButton } from "../../ui/ActionButton";
import type { loader as rootLoader } from "../../root";
import { TurnstileField } from "./TurnstileField";
import { WebPushField } from "./WebPushField";
import { createChromeReminderNormalizer } from "../../browser/chrome-reminder-normalizer";

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
      readonly result: Extract<
        CreateReminderAccepted,
        { readonly state: "active" }
      >;
      readonly calendar?: CalendarExportData;
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
      {reminder.destinationIds.map((destinationId) => (
        <input
          key={destinationId}
          type="hidden"
          name="destinationIds"
          value={destinationId}
        />
      ))}
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

function CalendarExportForm({
  calendar,
}: {
  readonly calendar: CalendarExportData;
}) {
  const [systemShareAvailable, setSystemShareAvailable] = useState(false);
  const [sharingCalendar, setSharingCalendar] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const probe = new File(
        ["BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n"],
        "reminder.ics",
        { type: "text/calendar" },
      );
      setSystemShareAvailable(
        typeof navigator.share === "function" &&
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [probe] }),
      );
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <form
      action="/calendar.ics"
      method="post"
      className={styles.calendarExport}
      onSubmit={(event) => {
        if (!systemShareAvailable) return;
        event.preventDefault();
        const form = event.currentTarget;
        setSharingCalendar(true);
        const contents = exportReminderCalendar(calendar, {
          now: new Date(),
          origin: window.location.origin,
        });
        const file = new File([contents], "reminder.ics", {
          type: "text/calendar",
        });
        void navigator
          .share({ files: [file], title: calendar.title })
          .catch((error: unknown) => {
            if (error instanceof DOMException && error.name === "AbortError") {
              return;
            }
            HTMLFormElement.prototype.submit.call(form);
          })
          .finally(() => {
            setSharingCalendar(false);
          });
      }}
    >
      <input type="hidden" name="title" value={calendar.title} />
      <input
        type="hidden"
        name="schedule"
        value={JSON.stringify(calendar.schedule)}
      />
      {calendar.managePath === undefined ? null : (
        <input type="hidden" name="managePath" value={calendar.managePath} />
      )}
      <button
        type="submit"
        className={styles.calendarButton}
        disabled={sharingCalendar}
      >
        <span aria-hidden="true">＋</span>
        {sharingCalendar
          ? "Opening calendar…"
          : systemShareAvailable
            ? "Add this reminder once"
            : "Download one-time calendar event"}
      </button>
      <small>
        {systemShareAvailable
          ? "Uses your system share sheet · recipient email reminders send directly when due"
          : "For Apple Calendar · Google Calendar · Outlook · recipient email reminders send directly when due"}
      </small>
    </form>
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
  const [quickBusy, setQuickBusy] = useState(false);
  const [interpretationSource, setInterpretationSource] =
    useState<ReminderInterpretationSource>("smart-rules");
  const quickRequest = useRef(0);
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
  const initialDestinationIds = (() => {
    const value = fieldValue(actionData, "destinationIds");
    if (value === "") return [];
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [];
    } catch {
      return [];
    }
  })();
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

  async function applyQuickReminder(timeZoneOverride?: string): Promise<void> {
    const form = formRef.current;
    if (form === null) return;
    const request = ++quickRequest.current;
    const timeZoneControl = form.elements.namedItem("timeZone");
    const timeZone =
      timeZoneOverride ??
      (timeZoneControl instanceof HTMLSelectElement
        ? timeZoneControl.value
        : "UTC");
    setQuickBusy(true);
    const interpretation = await interpretReminderText(
      quickText,
      { now: new Date().toISOString(), timeZone },
      createChromeReminderNormalizer(),
    );
    if (request !== quickRequest.current) return;
    setQuickBusy(false);
    const { result } = interpretation;
    if (!result.ok) {
      setParsedReminder(null);
      setQuickError(result.message);
      return;
    }

    setFormValue(form, "title", result.value.title);
    setFormValue(form, "localDate", result.value.localDate);
    setFormValue(form, "localTime", result.value.localTime);
    setParsedReminder(result.value);
    setInterpretationSource(interpretation.source);
    setQuickError(null);
    setManualExpanded(false);
    setScheduleExpanded(false);
  }

  function handleQuickKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void applyQuickReminder();
  }

  if (actionData?.stage === "created") {
    const emailDelivery = actionData.result.channels.includes("email");
    const browserDelivery = actionData.result.channels.includes("web_push");
    return (
      <section className={styles.result} aria-labelledby="active-title">
        <p className={styles.step}>
          Reminder active · {emailDelivery ? "Email" : "Browser"}
          {emailDelivery && browserDelivery ? " + browser" : ""} delivery
          {(actionData.result.destinationCount ?? 0) > 0
            ? ` + ${String(actionData.result.destinationCount)} saved destination${actionData.result.destinationCount === 1 ? "" : "s"}`
            : ""}
        </p>
        <h2 id="active-title">
          {emailDelivery
            ? "Your reminder is active"
            : "This browser will remind you"}
        </h2>
        <p>
          {emailDelivery
            ? "We’ll send the reminder when it is due. Every email includes unsubscribe controls for the recipient."
            : "A system notification will open its secure management page when it is due."}
        </p>
        {browserDelivery && emailDelivery ? (
          <p>
            If browser notifications fail, the email reminder still sends at the
            scheduled time.
          </p>
        ) : null}
        <a
          className={styles.previewLink}
          href={`/manage/${actionData.result.manageToken}`}
        >
          Manage reminder
        </a>
        {actionData.calendar === undefined ? null : (
          <CalendarExportForm calendar={actionData.calendar} />
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
              {actionData.reminder.destinationIds.length > 0
                ? ` · ${String(actionData.reminder.destinationIds.length)} saved destination${actionData.reminder.destinationIds.length === 1 ? "" : "s"}`
                : ""}
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
        <CalendarExportForm
          calendar={{
            title: actionData.reminder.title,
            schedule: actionData.reminder.schedule,
          }}
        />
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
            maxLength={500}
            value={quickText}
            onChange={(event) => {
              quickRequest.current += 1;
              setQuickText(event.target.value);
              setQuickError(null);
              setParsedReminder(null);
              setQuickBusy(false);
            }}
            onKeyDown={handleQuickKeyDown}
            aria-describedby="quickReminder-hint quickReminder-error"
            aria-invalid={quickError === null ? undefined : true}
            placeholder="Remind me to send the report tomorrow at 9am"
          />
          <span id="quickReminder-hint" className={styles.hint}>
            Try “in 30 minutes”, “next Monday”, or “every weekday at 9am”.
            Compatible desktop Chrome can use on-device AI.
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
              void applyQuickReminder();
            }}
            disabled={!hydrated || quickBusy}
          >
            {quickBusy ? "Understanding…" : "Set date & time"}
          </button>
        </fieldset>
      ) : null}

      {parsedReminder === null || manualExpanded ? null : (
        <section className={styles.parsedPreview} aria-live="polite">
          <span className={styles.parsedMarker}>
            Understood ·{" "}
            {interpretationSource === "on-device-ai"
              ? "On-device AI"
              : "Smart rules"}
          </span>
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
                    The reminder sends directly when due. The recipient can stop
                    all future delivery from the email.
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
            {rootData?.deliveryDestinations.map((destination) => (
              <label
                className={styles.externalDestination}
                key={destination.id}
              >
                <input
                  type="checkbox"
                  name="destinationIds"
                  value={destination.id}
                  defaultChecked={initialDestinationIds.includes(
                    destination.id,
                  )}
                  disabled={destination.status === "disabled"}
                />
                <span>
                  <strong>{destination.label}</strong>
                  <small>
                    {destination.type === "slack" ? "Slack" : "Webhook"} ·{" "}
                    {destination.detail}
                    {destination.status === "failing"
                      ? " · Needs attention"
                      : ""}
                  </small>
                </span>
              </label>
            ))}
          </div>
          {rootData?.user === null ? null : (
            <a className={styles.manageDestinations} href="/settings/email">
              Manage Slack and webhook delivery
            </a>
          )}
          <FieldError actionData={actionData} name="destinationIds" />
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
                void applyQuickReminder(event.target.value);
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
