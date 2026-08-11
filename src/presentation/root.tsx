import {
  data,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";

import type { Route } from "./+types/root";
import {
  createAuthSessionCookie,
  readAuthSessionToken,
} from "./auth-session.server";
import { applicationServicesContext } from "./server-context";
import "../styles/fonts.css";
import "../styles/tokens.css";
import "../styles/reset.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "manifest", href: "/site.webmanifest" },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const services = context.get(applicationServicesContext);
  const sessionToken = readAuthSessionToken(request.headers.get("cookie"));
  const session =
    sessionToken === null
      ? null
      : await services.auth.validateSession(sessionToken).catch(() => null);
  const loaderData = {
    lang: new URL(request.url).pathname.startsWith("/zh/")
      ? ("zh-CN" as const)
      : ("en" as const),
    user: session?.user ?? null,
    authLoginUrl: services.authLoginUrl,
    turnstileSiteKey: services.turnstileSiteKey,
    vapidPublicKey: services.vapidPublicKey,
    useLocalTurnstileBypass: services.showLocalVerificationPreview,
  };
  if (sessionToken === null || session === null) return data(loaderData);

  return data(loaderData, {
    headers: {
      "Cache-Control": "private, no-store",
      "Set-Cookie": createAuthSessionCookie({
        sessionToken,
        expiresAt: session.expiresAt,
        secure: services.secureAuthCookie,
      }),
    },
  });
}

export function Layout({ children }: { children: React.ReactNode }) {
  const rootData = useRouteLoaderData<typeof loader>("root");
  return (
    <html lang={rootData?.lang ?? "en"}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#2f5bff" />
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
      <p className="eyebrow">Reminders.work</p>
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
