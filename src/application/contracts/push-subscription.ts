import { z } from "zod";

const base64Url = /^[A-Za-z0-9_-]+$/;

function isBlockedIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }

  const [first = -1, second = -1] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
}

function isBlockedIpv6(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized)
  );
}

function safePushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username !== "" ||
      url.password !== "" ||
      url.hash !== "" ||
      (url.port !== "" && url.port !== "443")
    ) {
      return false;
    }
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".localhost") ||
      isBlockedIpv4(hostname) ||
      isBlockedIpv6(hostname)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export const pushSubscriptionSchema = z.object({
  endpoint: z
    .string()
    .max(2048)
    .refine(safePushEndpoint, "Enable notifications again in this browser."),
  expirationTime: z.number().int().positive().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(80).max(100).regex(base64Url),
    auth: z.string().min(20).max(32).regex(base64Url),
  }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
