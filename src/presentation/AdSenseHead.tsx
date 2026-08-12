import { adsenseClientId } from "./adsense";

export function AdSenseHead() {
  return <meta name="google-adsense-account" content={adsenseClientId} />;
}
