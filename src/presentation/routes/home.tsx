import type { ReminderDraftInput } from "../../application/contracts/create-reminder";
import type { CalendarExportData } from "../../application/contracts/calendar-export";
import type { PushSubscriptionInput } from "../../application/contracts/push-subscription";
import type { ComposerActionData } from "../features/reminder-composer/ReminderComposer";
import { ReminderComposer } from "../features/reminder-composer/ReminderComposer";
import { HomeOverview } from "../features/home-overview/HomeOverview";
import { applicationServicesContext } from "../server-context";
import { authenticatedUser } from "../require-auth.server";
import { TimeRail } from "../ui/TimeRail";
import { SiteHeader } from "../ui/SiteHeader";
import type { Route } from "./+types/home";
import type { ApplicationServices } from "../server-context";

export const meta: Route.MetaFunction = () => [
  { title: "Reminders.work — Free Online Reminders for Work" },
  {
    name: "description",
    content:
      "Create and manage one-time or recurring reminders with direct email and browser delivery, precise time zones, and recipient controls.",
  },
];

export function draftFromForm(form: FormData): ReminderDraftInput {
  const disambiguation = form.get("disambiguation");
  const stringField = (name: string): string => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  const recurrenceKind = stringField("recurrenceKind");
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

export async function action({
  request,
  context,
}: Route.ActionArgs): Promise<ComposerActionData | null> {
  const form = await request.formData();
  const services = context.get(applicationServicesContext);
  const user = await authenticatedUser(request, services);
  return handleComposerAction(form, services, user?.id);
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

export default function Home({ actionData }: Route.ComponentProps) {
  return (
    <main id="main-content" className="landing-shell">
      <SiteHeader
        navigation={[
          { href: "#features", label: "Features" },
          { href: "#how-it-works", label: "How it works" },
          { href: "#delivery", label: "Email delivery" },
        ]}
      />

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Free online reminders</p>
          <h1 id="hero-title">
            <span className="desktop-only">
              Set it once. Return when it matters.
            </span>
            <span className="mobile-only">What needs remembering?</span>
          </h1>
          <p className="hero-lede">
            <span className="desktop-only">
              Create a precise reminder for a task, meeting, or deadline. We
              show the local time, time zone, and UTC instant before anything is
              sent.
            </span>
            <span className="mobile-only">
              Choose what and when. We’ll notify this browser or your email.
            </span>
          </p>
          <ul className="trust-list desktop-only" aria-label="Product promises">
            <li>No account required</li>
            <li>Browser or direct email delivery</li>
            <li>Cancel or unsubscribe in one click</li>
          </ul>
        </div>

        <div className="instrument">
          <div className="instrument-head">
            <span>
              New reminder
              <small className="mobile-only instrument-note">
                No account · about one minute
              </small>
            </span>
            <span className="status-dot">
              {actionData?.stage === "review" ? "Review" : "Draft"}
            </span>
          </div>
          <TimeRail
            activeStep={
              actionData?.stage === "review" ? "scheduled" : "defined"
            }
          />
          <div className="composer-slot">
            <ReminderComposer actionData={actionData ?? undefined} />
          </div>
        </div>
      </section>
      <HomeOverview />
    </main>
  );
}
