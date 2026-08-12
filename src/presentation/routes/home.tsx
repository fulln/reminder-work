import type { ComposerActionData } from "../features/reminder-composer/ReminderComposer";
import { ReminderComposer } from "../features/reminder-composer/ReminderComposer";
import { handleComposerAction } from "../features/reminder-composer/composer-action.server";
import { HomeOverview } from "../features/home-overview/HomeOverview";
import { applicationServicesContext } from "../server-context";
import { authenticatedUser } from "../require-auth.server";
import { TimeRail } from "../ui/TimeRail";
import { SiteHeader } from "../ui/SiteHeader";
import type { Route } from "./+types/home";

export const meta: Route.MetaFunction = () => [
  { title: "Reminders.work — Free Online Reminders for Work" },
  {
    name: "description",
    content:
      "Create and manage one-time or recurring reminders with email, browser, Slack, and signed webhook delivery.",
  },
];

export async function action({
  request,
  context,
}: Route.ActionArgs): Promise<ComposerActionData | null> {
  const form = await request.formData();
  const services = context.get(applicationServicesContext);
  const user = await authenticatedUser(request, services);
  return handleComposerAction(form, services, user?.id);
}

export default function Home({ actionData }: Route.ComponentProps) {
  return (
    <main id="main-content" className="landing-shell">
      <SiteHeader
        navigation={[
          { href: "#features", label: "Features" },
          { href: "#how-it-works", label: "How it works" },
          { href: "#delivery", label: "Delivery" },
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
