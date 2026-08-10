import type { ReminderSchedule } from "./schedule";

export type ReminderStatus =
  | "draft"
  | "pending_verification"
  | "active"
  | "snoozed"
  | "completed"
  | "cancelled"
  | "expired";

const transitions: Readonly<Record<ReminderStatus, readonly ReminderStatus[]>> =
  {
    draft: ["pending_verification"],
    pending_verification: ["active", "cancelled", "expired"],
    active: ["snoozed", "completed", "cancelled", "expired"],
    snoozed: ["active", "completed", "cancelled", "expired"],
    completed: [],
    cancelled: [],
    expired: [],
  };

export interface Reminder {
  readonly id: string;
  readonly version: number;
  readonly status: ReminderStatus;
  readonly schedule: ReminderSchedule;
  readonly recipientRef: string;
  readonly contentCiphertext: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function canTransition(
  from: ReminderStatus,
  to: ReminderStatus,
): boolean {
  return transitions[from].includes(to);
}

export function assertTransition(
  from: ReminderStatus,
  to: ReminderStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`REMINDER_TRANSITION_INVALID: ${from} -> ${to}`);
  }
}

export function isTerminal(status: ReminderStatus): boolean {
  return ["completed", "cancelled", "expired"].includes(status);
}
