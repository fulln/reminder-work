import { afterEach, describe, expect, it, vi } from "vitest";

import { interpretReminderText } from "../../src/application/use-cases/interpret-reminder-text";
import {
  createChromeReminderNormalizer,
  resetChromeReminderNormalizerForTests,
} from "../../src/presentation/browser/chrome-reminder-normalizer";

const context = {
  now: "2026-08-11T02:15:00Z",
  timeZone: "Asia/Shanghai",
} as const;

afterEach(() => {
  delete (globalThis as { LanguageModel?: unknown }).LanguageModel;
  resetChromeReminderNormalizerForTests();
});

describe("interpretReminderText", () => {
  it("passes on-device normalization through deterministic parsing", async () => {
    const result = await interpretReminderText(
      "Please figure out when I should call Jordan",
      context,
      {
        normalize: () => Promise.resolve("Call Jordan on 2026-08-12 at 09:00"),
      },
    );

    expect(result).toEqual({
      source: "on-device-ai",
      result: {
        ok: true,
        value: {
          title: "Call Jordan",
          localDate: "2026-08-12",
          localTime: "09:00",
          timeZone: "Asia/Shanghai",
          recurrence: null,
        },
      },
    });
  });

  it.each([
    ["unavailable", { normalize: () => Promise.resolve(null) }],
    [
      "invalid output",
      {
        normalize: () =>
          Promise.resolve("This cannot pass deterministic parsing"),
      },
    ],
    [
      "model failure",
      {
        normalize: () => Promise.reject(new Error("model failed")),
      },
    ],
  ])("falls back to rules after %s", async (_case, normalizer) => {
    const result = await interpretReminderText(
      "Submit the report tomorrow at 9am",
      context,
      normalizer,
    );

    expect(result.source).toBe("smart-rules");
    expect(result.result).toMatchObject({
      ok: true,
      value: { title: "Submit the report", localTime: "09:00" },
    });
  });

  it("does not invoke a model for empty input", async () => {
    const normalize = vi.fn();
    const result = await interpretReminderText("", context, { normalize });

    expect(normalize).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      source: "smart-rules",
      result: { ok: false, code: "EMPTY" },
    });
  });
});

describe("Chrome reminder normalizer", () => {
  it("uses LanguageModel structured output when the local model is available", async () => {
    const prompt = vi
      .fn<
        (
          input: string,
          options: { readonly responseConstraint: { readonly type?: unknown } },
        ) => Promise<string>
      >()
      .mockResolvedValue(
        JSON.stringify({
          normalizedText: "Send notes on 2026-08-12 at 09:00",
        }),
      );
    const create = vi.fn().mockResolvedValue({ prompt });
    const availability = vi.fn().mockResolvedValue("available");
    (globalThis as { LanguageModel?: unknown }).LanguageModel = {
      availability,
      create,
    };

    const normalized = await createChromeReminderNormalizer()?.normalize(
      "send notes tomorrow morning",
      context,
    );

    expect(normalized).toBe("Send notes on 2026-08-12 at 09:00");
    expect(availability).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedInputs: [{ type: "text", languages: ["en"] }],
      }),
    );
    const call = prompt.mock.calls[0];
    expect(call?.[0]).toContain(
      "<reminder>send notes tomorrow morning</reminder>",
    );
    expect(call?.[1].responseConstraint.type).toBe("object");
  });

  it("does not create a session when the model is unavailable", async () => {
    const create = vi.fn();
    (globalThis as { LanguageModel?: unknown }).LanguageModel = {
      availability: vi.fn().mockResolvedValue("unavailable"),
      create,
    };

    const result = await createChromeReminderNormalizer()?.normalize(
      "Send notes tomorrow at 9am",
      context,
    );

    expect(result).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
});
