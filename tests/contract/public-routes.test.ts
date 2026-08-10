import { describe, expect, it } from "vitest";

import { capabilityPresets } from "../../src/content/capability-presets";

describe("public route metadata", () => {
  it("provides unique titles, descriptions, canonical paths, and hreflang peers", () => {
    for (const locale of ["en", "zh-CN"] as const) {
      const records = capabilityPresets.map((preset) => preset.content[locale]);
      expect(new Set(records.map((record) => record.title)).size).toBe(6);
      expect(new Set(records.map((record) => record.description)).size).toBe(6);
    }
    for (const preset of capabilityPresets) {
      expect(preset.slug).toMatch(/-reminder$/);
      expect(preset.content.en.hreflang).toBe(preset.content["zh-CN"].hreflang);
    }
  });
});
