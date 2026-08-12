import type { CalendarExportData } from "../../../application/contracts/calendar-export";
import type { ReminderDraftInput } from "../../../application/contracts/create-reminder";
import type { PushSubscriptionInput } from "../../../application/contracts/push-subscription";
import type { ApplicationServices } from "../../server-context";
import type { ComposerActionData } from "./ReminderComposer";

export function draftFromForm(form: FormData): ReminderDraftInput {
  const disambiguation = form.get("disambiguation");
  const stringField = (name: string): string => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  const recurrenceKind = stringField("recurrenceKind");
  const destinationIds = form
    .getAll("destinationIds")
    .flatMap((value) => (typeof value === "string" ? [value] : []));
  const deliveryModeValue = stringField("deliveryMode");
  const deliveryMode =
    deliveryModeValue === "web_push" ||
    deliveryModeValue === "web_push_email_fallback"
      ? deliveryModeValue
      : ("email" as const);
  const pushSubscription = (() => {
    const value = stringField("pushSubscription");
    if (value === "") return undefined;
    try {
      return JSON.parse(value) as PushSubscriptionInput;
    } catch {
      return undefined;
    }
  })();
  const recurrenceInterval = Number(stringField("recurrenceInterval") || "1");
  const localDate = stringField("localDate");
  const recurrenceWeekdays = form
    .getAll("recurrenceWeekdays")
    .flatMap((value) =>
      typeof value === "string" && /^[1-7]$/.test(value) ? [Number(value)] : [],
    );
  const anchorWeekday = (() => {
    const jsDay = new Date(`${localDate}T12:00:00Z`).getUTCDay();
    return jsDay === 0 ? 7 : Math.max(1, jsDay);
  })();
  const recurrenceDayOfMonth = Number(
    stringField("recurrenceDayOfMonth") || localDate.slice(-2),
  );
  const recurrence =
    recurrenceKind === "daily"
      ? { kind: "daily" as const, interval: recurrenceInterval }
      : recurrenceKind === "weekly"
        ? {
            kind: "weekly" as const,
            interval: recurrenceInterval,
            weekdays:
              recurrenceWeekdays.length > 0
                ? recurrenceWeekdays
                : [anchorWeekday],
          }
        : recurrenceKind === "monthly"
          ? {
              kind: "monthly" as const,
              interval: recurrenceInterval,
              dayOfMonth: recurrenceDayOfMonth,
              monthEndPolicy: "last-day" as const,
            }
          : null;
  return {
    schemaVersion: 1,
    title: stringField("title"),
    recipientEmail: stringField("recipientEmail"),
    deliveryMode,
    ...(pushSubscription === undefined ? {} : { pushSubscription }),
    localDate,
    localTime: stringField("localTime"),
    timeZone: stringField("timeZone"),
    turnstileToken: stringField("turnstileToken"),
    destinationIds,
    recurrence,
    leadOffsetsMinutes: form
      .getAll("leadOffsetsMinutes")
      .flatMap((value) =>
        typeof value === "string" && /^\d+$/.test(value) ? [Number(value)] : [],
      ),
    ...(disambiguation === "earlier" || disambiguation === "later"
      ? { disambiguation }
      : {}),
  };
}

export async function handleComposerAction(
  form: FormData,
  services: ApplicationServices,
  ownerUserId?: string,
): Promise<ComposerActionData | null> {
  const intentValue = form.get("intent");
  const intent = typeof intentValue === "string" ? intentValue : "review";
  const draft = draftFromForm(form);
  if (intent === "edit") {
    return {
      stage: "input-error",
      fields: {},
      values: valuesFromDraft(draft),
    };
  }

  if (intent === "review") {
    const result = services.reviewReminder(draft);
    return result.ok
      ? { stage: "review", reminder: result.value }
      : {
          stage: "input-error",
          fields: result.fields,
          values: result.values,
        };
  }

  const result = await services.createReminder(draft, ownerUserId);
  if (result.ok) {
    const calendar = calendarFromDraft(draft, services);
    return {
      stage: "created",
      result: result.data,
      ...(calendar === undefined
        ? {}
        : {
            calendar: {
              ...calendar,
              managePath: `/manage/${result.data.manageToken}`,
            },
          }),
    };
  }

  if (result.error.code === "TURNSTILE_REJECTED") {
    const reviewed = services.reviewReminder(draft);
    if (reviewed.ok) {
      return {
        stage: "review",
        reminder: reviewed.value,
        securityError:
          result.error.fields?.turnstileToken ??
          (["Complete the security check again."] as const),
      };
    }
  }

  return {
    stage: "create-error",
    message: result.error.form ?? "The reminder could not be created.",
    ...(result.error.fields === undefined
      ? {}
      : { fields: result.error.fields }),
    values: valuesFromDraft(draft),
  };
}

function valuesFromDraft(
  draft: ReminderDraftInput,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(draft).map(([key, value]) => [
      key,
      typeof value === "string" || typeof value === "number"
        ? String(value)
        : JSON.stringify(value ?? ""),
    ]),
  );
}

function calendarFromDraft(
  draft: ReminderDraftInput,
  services: ApplicationServices,
): CalendarExportData | undefined {
  const reviewed = services.reviewReminder(draft);
  return reviewed.ok
    ? { title: reviewed.value.title, schedule: reviewed.value.schedule }
    : undefined;
}
