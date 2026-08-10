import { Form, useRouteLoaderData } from "react-router";

import type { loader as rootLoader } from "../root";
import { SiteHeader } from "../ui/SiteHeader";
import type { Route } from "./+types/auth-login";
import styles from "./auth-login.module.css";

export const meta: Route.MetaFunction = () => [
  { title: "Sign in — Reminder.work" },
  { name: "robots", content: "noindex, nofollow" },
];

export function loader({ request }: Route.LoaderArgs) {
  const error = new URL(request.url).searchParams.get("error");
  return { hasError: error !== null };
}

export default function AuthLogin({ loaderData }: Route.ComponentProps) {
  const rootData = useRouteLoaderData<typeof rootLoader>("root");
  const user = rootData?.user ?? null;

  return (
    <div className={styles.shell}>
      <SiteHeader
        context="One account across your work tools."
        showAuthControl={false}
      />
      <main id="main-content" className={styles.main}>
        <section className={styles.card} aria-labelledby="sign-in-title">
          <p className="eyebrow">Secure sign in</p>
          <h1 id="sign-in-title">
            {user === null ? "Continue to Reminder.work" : "You’re signed in"}
          </h1>
          {user === null ? (
            <>
              <p className={styles.lede}>
                Use an existing account. Your provider password is never shared
                with Reminder.work.
              </p>
              {loaderData.hasError ? (
                <p className={styles.error} role="alert">
                  Sign in could not be completed. Please try again.
                </p>
              ) : null}
              <div className={styles.providers}>
                <Form method="post" action="/auth/start/google">
                  <button className={styles.providerButton} type="submit">
                    <span className={styles.providerMark} aria-hidden="true">
                      G
                    </span>
                    Continue with Google
                  </button>
                </Form>
                <Form method="post" action="/auth/start/github">
                  <button className={styles.providerButton} type="submit">
                    <span className={styles.providerMark} aria-hidden="true">
                      GH
                    </span>
                    Continue with GitHub
                  </button>
                </Form>
              </div>
              <p className={styles.privacyNote}>
                Authentication is handled by our shared Cloudflare identity
                service. Reminder.work stores only an opaque session cookie.
              </p>
            </>
          ) : (
            <>
              <p className={styles.signedIn}>
                Signed in as {user.displayName}. You can return to your reminder
                workspace.
              </p>
              <a className={styles.homeLink} href="/">
                Return to reminders
              </a>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
