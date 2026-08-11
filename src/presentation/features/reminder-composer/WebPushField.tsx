import { useEffect, useState } from "react";

import styles from "./ReminderComposer.module.css";

type PushState =
  | "checking"
  | "available"
  | "enabling"
  | "ready"
  | "denied"
  | "unsupported"
  | "error";

function applicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }
  return output;
}

function supportsWebPush(publicKey: string): boolean {
  return (
    publicKey !== "" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function serializeSubscription(subscription: PushSubscription): string {
  const value = subscription.toJSON();
  if (
    typeof value.endpoint !== "string" ||
    typeof value.keys?.p256dh !== "string" ||
    typeof value.keys.auth !== "string"
  ) {
    throw new Error("PUSH_SUBSCRIPTION_INVALID");
  }
  return JSON.stringify(value);
}

async function showTestNotification(
  registration: ServiceWorkerRegistration,
): Promise<void> {
  await registration.showNotification("Reminders.work is ready", {
    body: "This browser can receive your reminders.",
    tag: "reminders-work-test",
    icon: "/favicon.svg",
    data: { url: "/" },
  });
}

export function WebPushField({
  publicKey,
  initialSubscription = "",
  fieldError,
}: {
  readonly publicKey: string;
  readonly initialSubscription?: string;
  readonly fieldError?: readonly string[];
}) {
  const [state, setState] = useState<PushState>("checking");
  const [subscription, setSubscription] = useState(initialSubscription);

  useEffect(() => {
    queueMicrotask(() => {
      if (!supportsWebPush(publicKey)) {
        setState("unsupported");
        return;
      }
      setState(
        Notification.permission === "denied"
          ? "denied"
          : initialSubscription === ""
            ? "available"
            : "ready",
      );
    });
  }, [initialSubscription, publicKey]);

  async function enable(): Promise<void> {
    if (!supportsWebPush(publicKey)) {
      setState("unsupported");
      return;
    }
    setState("enabling");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      const existing = await registration.pushManager.getSubscription();
      const active =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(publicKey),
        }));
      setSubscription(serializeSubscription(active));
      await showTestNotification(registration);
      setState("ready");
    } catch {
      setState("error");
    }
  }

  async function testAgain(): Promise<void> {
    try {
      await showTestNotification(await navigator.serviceWorker.ready);
    } catch {
      setState("error");
    }
  }

  return (
    <div className={styles.pushField}>
      <input type="hidden" name="pushSubscription" value={subscription} />
      {state === "ready" ? (
        <div className={styles.pushReady} role="status">
          <span>
            <strong>Browser notifications enabled</strong>
            <small>A system test notification was sent to this device.</small>
          </span>
          <button type="button" onClick={() => void testAgain()}>
            Test again
          </button>
        </div>
      ) : state === "available" ||
        state === "checking" ||
        state === "enabling" ||
        state === "error" ? (
        <button
          className={styles.enablePushButton}
          type="button"
          onClick={() => void enable()}
          disabled={state === "checking" || state === "enabling"}
        >
          {state === "enabling"
            ? "Enabling notifications…"
            : "Enable browser notifications"}
        </button>
      ) : null}
      {state === "unsupported" ? (
        <span className={styles.hint} role="status">
          Browser notifications are unavailable here. Choose Email instead.
        </span>
      ) : null}
      {state === "denied" ? (
        <span className={styles.fieldError} role="alert">
          Notifications are blocked. Enable them in browser settings or choose
          Email.
        </span>
      ) : null}
      {state === "error" ? (
        <span className={styles.fieldError} role="alert">
          This browser could not subscribe. Try again or choose Email.
        </span>
      ) : null}
      {fieldError === undefined ? null : (
        <span className={styles.fieldError} id="pushSubscription-error">
          {fieldError.join(" ")}
        </span>
      )}
    </div>
  );
}
