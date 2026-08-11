import type { OnDeviceTextNormalizer } from "../ports/on-device-text-normalizer";
import {
  parseReminderText,
  type ParseReminderTextResult,
  type ReminderParseContext,
} from "../../domain/reminder/parse-reminder-text";

export type ReminderInterpretationSource = "on-device-ai" | "smart-rules";

export interface ReminderTextInterpretation {
  readonly result: ParseReminderTextResult;
  readonly source: ReminderInterpretationSource;
}

const onDeviceTimeoutMs = 8_000;

async function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error("On-device reminder interpretation timed out."));
        }, onDeviceTimeoutMs);
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export async function interpretReminderText(
  input: string,
  context: ReminderParseContext,
  normalizer?: OnDeviceTextNormalizer,
): Promise<ReminderTextInterpretation> {
  if (input.trim().length === 0 || normalizer === undefined) {
    return {
      result: parseReminderText(input, context),
      source: "smart-rules",
    };
  }

  try {
    const normalized = await withTimeout(normalizer.normalize(input, context));
    if (normalized !== null) {
      const interpreted = parseReminderText(normalized, context);
      if (interpreted.ok) {
        return { result: interpreted, source: "on-device-ai" };
      }
    }
  } catch {
    // Browser AI is optional. Deterministic parsing remains the contract.
  }

  return {
    result: parseReminderText(input, context),
    source: "smart-rules",
  };
}
