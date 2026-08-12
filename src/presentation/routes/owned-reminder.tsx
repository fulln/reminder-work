import { ReminderManagement } from "../features/reminder-management/ReminderManagement";
import accountStyles from "../features/account/AccountWorkspace.module.css";
import { requireAuthenticatedUser } from "../require-auth.server";
import { applicationServicesContext } from "../server-context";
import { SiteHeader } from "../ui/SiteHeader";
import type { Route } from "./+types/owned-reminder";

export const meta: Route.MetaFunction = () => [
  { title: "Manage reminder — Reminders.work" },
  { name: "robots", content: "noindex, nofollow" },
];

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const services = context.get(applicationServicesContext);
  const user = await requireAuthenticatedUser(request, services);
  if (user instanceof Response) return user;
  return services.getOwnedReminderView(user.id, params.id);
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const services = context.get(applicationServicesContext);
  const user = await requireAuthenticatedUser(request, services);
  if (user instanceof Response) return user;
  const form = await request.formData();
  const intent = form.get("intent");
  const expectedVersion = Number(form.get("version"));
  if (intent === "complete" || intent === "cancel") {
    return services.manageOwnedReminder(user.id, {
      reminderId: params.id,
      expectedVersion,
      action: intent,
    });
  }
  if (intent === "snooze") {
    return services.manageOwnedReminder(user.id, {
      reminderId: params.id,
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
        requestId: services.requestId,
        error: {
          code: "SCHEDULE_INVALID",
          retryable: false,
          form: "Enter a valid future date and time.",
        },
      };
    }
    return services.manageOwnedReminder(user.id, {
      reminderId: params.id,
      expectedVersion,
      action: "reschedule",
      anchorLocal,
      resolvedUtc: resolved.toISOString(),
    });
  }
  return {
    ok: false as const,
    requestId: services.requestId,
    error: {
      code: "ACTION_INVALID",
      retryable: false,
      form: "Choose a valid reminder action.",
    },
  };
}

export default function OwnedReminderRoute({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  if (!loaderData.ok) {
    return (
      <main id="main-content" className="error-page">
        <p className="eyebrow">Reminder management</p>
        <h1>Reminder unavailable</h1>
        <p>This reminder does not exist or does not belong to your account.</p>
        <a href="/reminders">Return to reminders</a>
      </main>
    );
  }
  return (
    <div className={accountStyles.page}>
      <SiteHeader />
      {actionData?.ok === false ? (
        <p role="alert" className="route-alert">
          {actionData.error.form}
        </p>
      ) : null}
      <ReminderManagement view={loaderData.data} />
    </div>
  );
}
