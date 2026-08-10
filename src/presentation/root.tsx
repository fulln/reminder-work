import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";

import type { Route } from "./+types/root";
import "../styles/fonts.css";
import "../styles/tokens.css";
import "../styles/reset.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
];

export function loader({ request }: Route.LoaderArgs) {
  return {
    lang: new URL(request.url).pathname.startsWith("/zh/")
      ? ("zh-CN" as const)
      : ("en" as const),
  };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const rootData = useRouteLoaderData<typeof loader>("root");
  return (
    <html lang={rootData?.lang ?? "en"}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <main id="main-content" className="error-page">
      <p className="eyebrow">Reminder.work</p>
      <h1>
        {notFound ? "This page could not be found" : "Something went wrong"}
      </h1>
      <p>
        {notFound
          ? "Check the address or return to the reminder creator."
          : "Your reminder details were not lost. Please try again."}
      </p>
      <a href="/">Create a reminder</a>
    </main>
  );
}
