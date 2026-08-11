import { Form, useRouteLoaderData } from "react-router";

import type { loader as rootLoader } from "../root";
import styles from "./SiteHeader.module.css";

export function SiteHeader({
  context,
  utilityLink,
  locale = "en",
  showAuthControl = true,
}: {
  readonly context?: string;
  readonly utilityLink?: {
    readonly href: string;
    readonly label: string;
    readonly hrefLang?: string;
  };
  readonly locale?: "en" | "zh-CN";
  readonly showAuthControl?: boolean;
}) {
  const rootData = useRouteLoaderData<typeof rootLoader>("root");
  const user = rootData?.user ?? null;

  return (
    <header className="site-header">
      <a className="wordmark" href="/" aria-label="Reminders.work home">
        Reminders<span>.work</span>
      </a>
      <div className={styles.controls}>
        {context ? <span className={styles.context}>{context}</span> : null}
        {utilityLink ? (
          <a
            className={styles.utilityLink}
            href={utilityLink.href}
            hrefLang={utilityLink.hrefLang}
          >
            {utilityLink.label}
          </a>
        ) : null}
        {!showAuthControl ? null : user === null ? (
          <a className={styles.authLink} href="/auth/login">
            {locale === "zh-CN" ? "登录" : "Sign in"}
          </a>
        ) : (
          <>
            <span className={styles.identity}>{user.displayName}</span>
            <Form
              className={styles.logoutForm}
              method="post"
              action="/auth/logout"
            >
              <button className={styles.logoutButton} type="submit">
                {locale === "zh-CN" ? "退出" : "Sign out"}
              </button>
            </Form>
          </>
        )}
      </div>
    </header>
  );
}
