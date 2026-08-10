import { applicationServicesContext } from "../server-context";
import { ReminderManagement } from "../features/reminder-management/ReminderManagement";
import type { Route } from "./+types/manage";

export const meta: Route.MetaFunction = () => [
  { title: "Manage reminder — Reminder.work" },
  { name: "robots", content: "noindex, nofollow" },
];

export function loader({ params, context }: Route.LoaderArgs) {
  return context.get(applicationServicesContext).getReminderView(params.token);
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = form.get("intent");
  const expectedVersion = Number(form.get("version"));
  const service = context.get(applicationServicesContext);
  if (intent === "complete" || intent === "cancel") {
    return service.manageReminder({
      token: params.token,
      expectedVersion,
      action: intent,
    });
  }
  if (intent === "snooze") {
    return service.manageReminder({
      token: params.token,
      expectedVersion,
      action: "snooze",
      minutes: Number(form.get("minutes")),
    });
  }
  if (intent === "reschedule") {
    const dateTime = form.get("dateTime");
    const anchorLocal = typeof dateTime === "string" ? dateTime : "";
    const resolved = new Date(anchorLocal);
    if (anchorLocal === "" || Number.isNaN(resolved.getTime())) {
      return {
        ok: false as const,
        requestId: service.requestId,
        error: {
          code: "SCHEDULE_INVALID",
          retryable: false,
          form: "Enter a valid future date and time.",
        },
      };
    }
    return service.manageReminder({
      token: params.token,
      expectedVersion,
      action: "reschedule",
      anchorLocal,
      resolvedUtc: resolved.toISOString(),
    });
  }
  return {
    ok: false as const,
    requestId: service.requestId,
    error: {
      code: "ACTION_INVALID",
      retryable: false,
      form: "Choose a valid reminder action.",
    },
  };
}

export default function ManageReminderRoute({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  if (!loaderData.ok) {
    return <Unavailable />;
  }
  return (
    <>
      {actionData?.ok === false ? (
        <p role="alert" className="route-alert">
          {actionData.error.form}
        </p>
      ) : null}
      <ReminderManagement view={loaderData.data} />
    </>
  );
}

function Unavailable() {
  return (
    <main id="main-content" className="error-page">
      <p className="eyebrow">Reminder.work</p>
      <h1>This link is unavailable</h1>
      <p>It may be invalid or expired. No reminder details are shown.</p>
      <a href="/">Create a reminder</a>
    </main>
  );
}
