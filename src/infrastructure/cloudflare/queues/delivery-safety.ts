import { isTerminal } from "../../../domain/reminder/reminder";
import type { Reminder } from "../../../domain/reminder/reminder";

export type DeliveryDecision =
  | "deliver"
  | "skip-terminal"
  | "skip-suppressed"
  | "skip-version"
  | "skip-inactive";

export function deliveryDecision(
  reminder: Reminder,
  expectedVersion: number,
  suppressed: boolean,
): DeliveryDecision {
  if (isTerminal(reminder.status)) return "skip-terminal";
  if (suppressed) return "skip-suppressed";
  if (reminder.version !== expectedVersion) return "skip-version";
  if (reminder.status !== "active" && reminder.status !== "snoozed")
    return "skip-inactive";
  return "deliver";
}
