const reservedHostnames = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "reminders.work",
  "www.reminders.work",
  "auth.elemvisual.com",
]);

function isIpv4Literal(hostname: string): boolean {
  const parts = hostname.split(".");
  return (
    parts.length === 4 &&
    parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
  );
}

export function normalizeOutboundWebhookUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.hash !== "" ||
    hostname === "" ||
    reservedHostnames.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    isIpv4Literal(hostname) ||
    hostname.includes(":")
  ) {
    return null;
  }
  return url.toString();
}
