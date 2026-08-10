import { resolveLocalTime } from "../time/resolve-local-time";
import type { CreateScheduleInput, ReminderSchedule } from "./schedule";

export function createSchedule(input: CreateScheduleInput): ReminderSchedule {
  const resolved = resolveLocalTime(
    input.localDate,
    input.localTime,
    input.timeZone,
    input.disambiguation,
  );
  const leadOffsets = [...(input.leadOffsetsMinutes ?? [])];

  if (leadOffsets.some((offset) => !Number.isInteger(offset) || offset < 0)) {
    throw new Error("SCHEDULE_LEAD_INVALID");
  }

  const recurrence = input.recurrence ?? null;
  return {
    kind: recurrence === null ? "once" : "recurring",
    anchorLocal: resolved.localDateTime,
    timeZone: resolved.timeZone,
    resolvedUtc: resolved.instant,
    recurrence,
    leadOffsetsMinutes: [...new Set(leadOffsets)].sort((a, b) => b - a),
  };
}
