import { Form, useLocation, useRouteLoaderData } from "react-router";

import type { loader as rootLoader } from "../root";
import styles from "./SiteHeader.module.css";

export function SiteHeader({
  context,
  navigation,
  utilityLink,
  locale = "en",
  showAuthControl = true,
}: {
  readonly context?: string;
  readonly navigation?: readonly {
    readonly href: string;
    readonly label: string;
  }[];
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
  const location = useLocation();
  const visibleNavigation =
    user === null
      ? navigation
      : navigation?.filter(
          (item) => item.href !== "#delivery" && item.label !== "Delivery",
        );
  const initials =
    user === null
      ? "U"
      : user.displayName
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part.charAt(0).toUpperCase())
          .join("");

  return (
    <header
      className={`site-header ${styles.header ?? ""}`}
      data-authenticated={user !== null}
    >
      <a className="wordmark" href="/" aria-label="Reminders.work home">
        Reminders<span>.work</span>
      </a>
      <div className={styles.navigation}>
        {visibleNavigation === undefined ||
        visibleNavigation.length === 0 ? null : (
          <nav className={styles.marketingNav} aria-label="Product">
            {visibleNavigation.map((item) => (
              <a href={item.href} key={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
        )}
        {!showAuthControl || user === null ? null : (
          <nav className={styles.accountNav} aria-label="Account sections">
            <a
              href="/reminders"
              aria-current={
                location.pathname.startsWith("/reminders") ? "page" : undefined
              }
            >
              Reminders
            </a>
            <a
              href="/settings/email"
              aria-current={
                location.pathname === "/settings/email" ? "page" : undefined
              }
            >
              Delivery
            </a>
          </nav>
        )}
      </div>
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
          <a
            className={styles.authLink}
            href={rootData?.authLoginUrl ?? "/auth/login"}
          >
            {locale === "zh-CN" ? "登录" : "Sign in"}
          </a>
        ) : (
          <details className={styles.accountMenu}>
            <summary
              className={styles.identity}
              title={user.displayName}
              aria-label={`Account menu for ${user.displayName}`}
            >
              <span className={styles.avatar} aria-hidden="true">
                {initials}
              </span>
              <span className={styles.identityName}>{user.displayName}</span>
              <span className={styles.menuChevron} aria-hidden="true">
                ▾
              </span>
            </summary>
            <div className={styles.accountPopover}>
              <div className={styles.accountSummary}>
                <span className={styles.avatar} aria-hidden="true">
                  {initials}
                </span>
                <span>
                  <small>
                    {locale === "zh-CN" ? "已登录" : "Signed in as"}
                  </small>
                  <strong>{user.displayName}</strong>
                </span>
              </div>
              <Form
                className={styles.logoutForm}
                method="post"
                action="/auth/logout"
              >
                <button className={styles.logoutButton} type="submit">
                  {locale === "zh-CN" ? "退出登录" : "Sign out"}
                </button>
              </Form>
            </div>
          </details>
        )}
      </div>
    </header>
  );
}
