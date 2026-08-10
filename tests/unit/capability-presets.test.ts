import { describe, expect, it } from "vitest";

import {
  capabilityPresets,
  capabilityPresetSchema,
} from "../../src/content/capability-presets";

describe("capability presets", () => {
  it("defines exactly six valid, differentiated presets", () => {
    expect(capabilityPresets).toHaveLength(6);
    expect(
      capabilityPresets.every(
        (preset) => capabilityPresetSchema.safeParse(preset).success,
      ),
    ).toBe(true);
    expect(
      new Set(capabilityPresets.map((preset) => preset.exampleTitle)).size,
    ).toBe(6);
    expect(
      new Set(
        capabilityPresets.map((preset) =>
          JSON.stringify(preset.visibleOptions),
        ),
      ).size,
    ).toBe(6);
  });

  it("keeps preset defaults compatible with the canonical reminder input", () => {
    for (const preset of capabilityPresets) {
      expect(preset.defaults.timeZone).toMatch(
        /^[A-Za-z_]+\/[A-Za-z_]+$|^UTC$/,
      );
      expect(preset.defaults.leadOffsetsMinutes.every(Number.isInteger)).toBe(
        true,
      );
    }
  });
});
