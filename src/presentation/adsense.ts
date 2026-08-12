export const adsenseClientId = "ca-pub-3211121736772217";

const monetizedCapabilityPaths = new Set([
  "/online-reminder",
  "/email-reminder",
  "/recurring-reminder",
  "/meeting-reminder",
  "/deadline-reminder",
  "/follow-up-reminder",
]);

export function shouldLoadAdSense(pathname: string): boolean {
  const englishPath = pathname.startsWith("/zh/")
    ? pathname.slice("/zh".length)
    : pathname;
  return monetizedCapabilityPaths.has(englishPath);
}
