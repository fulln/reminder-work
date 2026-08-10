export type MonthEndPolicy = "last-day" | "skip";

export type RecurrenceRule =
  | { readonly kind: "daily"; readonly interval: number }
  | {
      readonly kind: "weekly";
      readonly interval: number;
      readonly weekdays: readonly number[];
    }
  | {
      readonly kind: "monthly";
      readonly interval: number;
      readonly dayOfMonth: number;
      readonly monthEndPolicy: MonthEndPolicy;
    };

export interface ReminderSchedule {
  readonly kind: "once" | "recurring";
  readonly anchorLocal: string;
  readonly timeZone: string;
  readonly resolvedUtc: string;
  readonly recurrence: RecurrenceRule | null;
  readonly leadOffsetsMinutes: readonly number[];
}

export interface CreateScheduleInput {
  readonly localDate: string;
  readonly localTime: string;
  readonly timeZone: string;
  readonly disambiguation?: "earlier" | "later";
  readonly recurrence?: RecurrenceRule | null;
  readonly leadOffsetsMinutes?: readonly number[];
}
