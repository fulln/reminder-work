import { useEffect } from "react";

import { adsenseClientId, shouldLoadAdSense } from "./adsense";

const scriptId = "reminders-work-adsense";
const loadDelayMs = 1_500;

export function AdSenseLoader({ pathname }: { readonly pathname: string }) {
  useEffect(() => {
    if (!shouldLoadAdSense(pathname)) return;

    const load = () => {
      if (document.getElementById(scriptId) !== null) return;
      const script = document.createElement("script");
      script.id = scriptId;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src =
        "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js" +
        `?client=${adsenseClientId}`;
      document.head.appendChild(script);
    };

    let timeoutId: number | undefined;
    const scheduleLoad = () => {
      timeoutId = window.setTimeout(load, loadDelayMs);
    };

    if (document.readyState === "complete") {
      scheduleLoad();
    } else {
      window.addEventListener("load", scheduleLoad, { once: true });
    }
    return () => {
      window.removeEventListener("load", scheduleLoad);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [pathname]);

  return null;
}
