import { z } from "zod";

const emailSchema = z.email("Enter a valid email address.");

export function normalizeEmailAddress(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return emailSchema.safeParse(normalized).success ? normalized : null;
}

export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  const shown =
    local.length <= 2
      ? `${local.slice(0, 1)}*`
      : `${local.slice(0, 1)}${"*".repeat(Math.min(3, local.length - 2))}${local.slice(-1)}`;
  return `${shown}@${domain}`;
}
