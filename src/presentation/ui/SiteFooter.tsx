import { useLocation } from "react-router";

export function SiteFooter() {
  const location = useLocation();
  const year = new Date().getUTCFullYear();
  return (
    <footer className="site-footer">
      <p>© {year} Reminders.work</p>
      <nav aria-label="Site information">
        <a href="/about">About</a>
        <a href="/privacy">Privacy</a>
        <a href="/contact">Contact</a>
      </nav>
      {location.pathname === "/privacy" ? (
        <p className="site-footer-note">
          Advertising choices can also be managed through the consent message
          shown where required.
        </p>
      ) : null}
    </footer>
  );
}
