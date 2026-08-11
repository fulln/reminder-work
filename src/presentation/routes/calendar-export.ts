import { calendarExportSchema } from "../../application/contracts/calendar-export";
import { exportReminderCalendar } from "../../application/use-cases/export-calendar";
import type { Route } from "./+types/calendar-export";

export function calendarExportFromForm(form: FormData): unknown {
  const title = form.get("title");
  const scheduleValue = form.get("schedule");
  const managePath = form.get("managePath");
  let schedule: unknown;
  try {
    schedule =
      typeof scheduleValue === "string" ? JSON.parse(scheduleValue) : null;
  } catch {
    schedule = null;
  }
  return {
    title: typeof title === "string" ? title : "",
    schedule,
    ...(typeof managePath === "string" && managePath !== ""
      ? { managePath }
      : {}),
  };
}

export function loader(): Response {
  return new Response("Calendar export requires a reviewed reminder.", {
    status: 405,
    headers: { Allow: "POST", "Cache-Control": "no-store" },
  });
}

export async function action({ request }: Route.ActionArgs): Promise<Response> {
  const parsed = calendarExportSchema.safeParse(
    calendarExportFromForm(await request.formData()),
  );
  if (!parsed.success) {
    return new Response("The calendar file could not be created.", {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const origin = new URL(request.url).origin;
  return new Response(
    exportReminderCalendar(parsed.data, { now: new Date(), origin }),
    {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": 'attachment; filename="reminder.ics"',
        "Content-Type": "text/calendar; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
