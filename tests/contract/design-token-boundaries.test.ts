import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("design token guard", () => {
  it("rejects raw colors in presentation CSS", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/check-design-tokens.mjs", "tests/contract/fixtures/invalid"],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("DESIGN-TOKEN-001");
    expect(result.stderr).toContain("RawValues.module.css");
  });
});
