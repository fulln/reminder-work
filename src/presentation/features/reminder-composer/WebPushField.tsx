import { useEffect, useState } from "react";

import styles from "./ReminderComposer.module.css";

type PushState =
  | "checking"
  | "available"
  | "enabling"
  | "ready"
  | "denied"
  | "denied-again"
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
  const [testNotificationFailed, setTestNotificationFailed] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState("");

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
    const wasDenied = state === "denied" || state === "denied-again";
    setSubscriptionError("");
    setTestNotificationFailed(false);
    setState("enabling");
    let stage: "service-worker" | "subscription" = "service-worker";
    try {
      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }
      if (permission !== "granted") {
        setState(wasDenied ? "denied-again" : "denied");
        return;
      }
      await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      const registration = await navigator.serviceWorker.ready;
      stage = "subscription";
      const existing = await registration.pushManager.getSubscription();
      const active =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(publicKey),
        }));
      setSubscription(serializeSubscription(active));
      setState("ready");
      try {
        await showTestNotification(registration);
      } catch {
        setTestNotificationFailed(true);
      }
    } catch {
      setSubscriptionError(
        stage === "service-worker"
          ? "Notification setup did not finish. Reload this page and try again."
          : "Chrome could not create a push subscription. Check that Notifications are allowed, then try again.",
      );
      setState("error");
    }
  }

  async function testAgain(): Promise<void> {
    setTestNotificationFailed(false);
    try {
      await showTestNotification(await navigator.serviceWorker.ready);
    } catch {
      setTestNotificationFailed(true);
    }
  }

  return (
    <div className={styles.pushField}>
      <input type="hidden" name="pushSubscription" value={subscription} />
      {state === "ready" ? (
        <div className={styles.pushReady} role="status">
          <span>
            <strong>Browser notifications enabled</strong>
            <small>
              {testNotificationFailed
                ? "Push is active, but the test notification could not be displayed."
                : "This browser can receive your reminders."}
            </small>
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
      {state === "denied" || state === "denied-again" ? (
        <div className={styles.pushDenied}>
          <span role="alert">
            <strong>
              {state === "denied-again"
                ? "Notifications are still blocked"
                : "Notifications are blocked"}
            </strong>
            <small>
              Open this site&apos;s settings from the address bar, set
              Notifications to Allow, then retry.
            </small>
          </span>
          <button
            className={styles.retryPushButton}
            type="button"
            onClick={() => void enable()}
          >
            I&apos;ve allowed it — retry
          </button>
        </div>
      ) : null}
      {state === "error" ? (
        <span className={styles.fieldError} role="alert">
          {subscriptionError}
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
