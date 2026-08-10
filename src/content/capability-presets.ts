import { z } from "zod";

import { englishCapabilityContent } from "./en";
import { chineseCapabilityContent } from "./zh-CN";

const capabilityIdSchema = z.enum([
  "online",
  "email",
  "recurring",
  "meeting",
  "deadline",
  "follow-up",
]);

const contentSchema = z.object({
  eyebrow: z.string().min(1),
  heading: z.string().min(1),
  lede: z.string().min(1),
  example: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  hreflang: z.string().min(1),
});

export const capabilityPresetSchema = z.object({
  id: capabilityIdSchema,
  slug: z.string().regex(/-reminder$/),
  exampleTitle: z.string().min(1),
  visibleOptions: z.array(
    z.enum([
      "verification",
      "recurrence",
      "lead-time",
      "lead-times",
      "meeting-context",
      "acknowledgement",
    ]),
  ),
  defaults: z.object({
    localTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    timeZone: z.string().min(1),
    leadOffsetsMinutes: z.array(z.number().int().nonnegative()),
    recurrenceKind: z.enum(["none", "daily", "weekly", "monthly"]),
  }),
  content: z.object({ en: contentSchema, "zh-CN": contentSchema }),
});

export type CapabilityPreset = z.infer<typeof capabilityPresetSchema>;
export type CapabilityLocale = "en" | "zh-CN";

const definitions = [
  ["online", "online-reminder", "Review the quarterly plan", [], [], "none"],
  [
    "email",
    "email-reminder",
    "Send the project status update",
    ["verification"],
    [],
    "none",
  ],
  [
    "recurring",
    "recurring-reminder",
    "Submit the weekly report",
    ["recurrence"],
    [],
    "weekly",
  ],
  [
    "meeting",
    "meeting-reminder",
    "Prepare for the client call",
    ["lead-time", "meeting-context"],
    [30],
    "none",
  ],
  [
    "deadline",
    "deadline-reminder",
    "Submit the filing",
    ["lead-times"],
    [10080, 1440],
    "none",
  ],
  [
    "follow-up",
    "follow-up-reminder",
    "Follow up on the proposal",
    ["acknowledgement"],
    [1440],
    "none",
  ],
] as const;

export const capabilityPresets: readonly CapabilityPreset[] = definitions.map(
  ([
    id,
    slug,
    exampleTitle,
    visibleOptions,
    leadOffsetsMinutes,
    recurrenceKind,
  ]) =>
    capabilityPresetSchema.parse({
      id,
      slug,
      exampleTitle,
      visibleOptions,
      defaults: {
        localTime: "09:00",
        timeZone: "Asia/Shanghai",
        leadOffsetsMinutes,
        recurrenceKind,
      },
      content: {
        en: { ...englishCapabilityContent[id], hreflang: id },
        "zh-CN": { ...chineseCapabilityContent[id], hreflang: id },
      },
    }),
);

export function findCapabilityPreset(
  slug: string,
): CapabilityPreset | undefined {
  return capabilityPresets.find((preset) => preset.slug === slug);
}
