import { useEffect, useRef, useState } from "react";

import styles from "./ReminderComposer.module.css";

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-script";
const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
export const TURNSTILE_ACTION = "create_reminder";

interface TurnstileRenderOptions {
  readonly sitekey: string;
  readonly action: string;
  readonly size: "flexible";
  readonly appearance: "always";
  readonly callback: (token: string) => void;
  readonly "expired-callback": () => void;
  readonly "error-callback": () => void;
}

interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileRenderOptions): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

type WindowWithTurnstile = Window & { turnstile?: TurnstileApi };

let scriptLoad: Promise<TurnstileApi> | undefined;

function loadTurnstile(): Promise<TurnstileApi> {
  const browserWindow = window as WindowWithTurnstile;
  if (browserWindow.turnstile !== undefined) {
    return Promise.resolve(browserWindow.turnstile);
  }
  if (scriptLoad !== undefined) return scriptLoad;

  scriptLoad = new Promise((resolve, reject) => {
    const resolveApi = () => {
      if (browserWindow.turnstile === undefined) {
        reject(new Error("Turnstile loaded without its browser API."));
        return;
      }
      resolve(browserWindow.turnstile);
    };
    const rejectLoad = () => {
      scriptLoad = undefined;
      reject(new Error("Turnstile could not be loaded."));
    };
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID);
    if (existing !== null) {
      existing.addEventListener("load", resolveApi, { once: true });
      existing.addEventListener("error", rejectLoad, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", resolveApi, { once: true });
    script.addEventListener("error", rejectLoad, { once: true });
    document.head.appendChild(script);
  });
  return scriptLoad;
}

export function TurnstileField({
  siteKey,
  useLocalBypass,
  fieldError,
  step = 4,
}: {
  readonly siteKey: string;
  readonly useLocalBypass: boolean;
  readonly fieldError?: readonly string[];
  readonly step?: 3 | 4;
}) {
  const container = useRef<HTMLDivElement>(null);
  const api = useRef<TurnstileApi>(null);
  const widgetId = useRef<string>(undefined);
  const [token, setToken] = useState(useLocalBypass ? "test-pass" : "");
  const [status, setStatus] = useState<
    "loading" | "ready" | "verified" | "error"
  >(useLocalBypass ? "verified" : "loading");

  useEffect(() => {
    if (useLocalBypass) return;
    let active = true;

    void loadTurnstile()
      .then((turnstile) => {
        if (!active || container.current === null) return;
        api.current = turnstile;
        widgetId.current = turnstile.render(container.current, {
          sitekey: siteKey,
          action: TURNSTILE_ACTION,
          size: "flexible",
          appearance: "always",
          callback: (nextToken) => {
            if (!active) return;
            setToken(nextToken);
            setStatus("verified");
          },
          "expired-callback": () => {
            if (!active) return;
            setToken("");
            setStatus("ready");
            if (widgetId.current !== undefined) {
              turnstile.reset(widgetId.current);
            }
          },
          "error-callback": () => {
            if (!active) return;
            setToken("");
            setStatus("error");
          },
        });
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });

    return () => {
      active = false;
      if (api.current !== null && widgetId.current !== undefined) {
        api.current.remove(widgetId.current);
      }
    };
  }, [siteKey, useLocalBypass]);

  return (
    <fieldset className={styles.securityField}>
      <legend>{String(step).padStart(2, "0")} · Security</legend>
      <input type="hidden" name="turnstileToken" value={token} />
      {useLocalBypass ? null : <div ref={container} />}
      <span className={styles.hint} aria-live="polite">
        {status === "loading"
          ? "Loading the security check…"
          : status === "verified"
            ? "Security check complete."
            : status === "error"
              ? "The security check could not load. Reload and try again."
              : "Protected by Cloudflare Turnstile."}
      </span>
      {fieldError === undefined ? null : (
        <span className={styles.fieldError} id="turnstileToken-error">
          {fieldError.join(" ")}
        </span>
      )}
    </fieldset>
  );
}
