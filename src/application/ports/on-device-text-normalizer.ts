import type { ReminderParseContext } from "../../domain/reminder/parse-reminder-text";

export interface OnDeviceTextNormalizer {
  normalize(
    input: string,
    context: ReminderParseContext,
  ): Promise<string | null>;
}
