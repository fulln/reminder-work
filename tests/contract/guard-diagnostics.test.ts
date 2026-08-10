import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const commands = [
  ["scripts/check-architecture.mjs", "ARCH-DOMAIN-001", "Fix:"],
  ["scripts/check-design-tokens.mjs", "DESIGN-TOKEN-001", "Fix:"],
  ["scripts/check-contract-versions.mjs", "CONTRACT-VERSION-001", "Fix:"],
] as const;

describe("guard diagnostics", () => {
  it.each(commands)(
    "%s identifies its rule, location, and recovery",
    (script, rule, recovery) => {
      const result = spawnSync(
        process.execPath,
        [script, "tests/contract/fixtures/invalid"],
        { cwd: process.cwd(), encoding: "utf8" },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(rule);
      expect(result.stderr).toContain("tests/contract/fixtures/invalid");
      expect(result.stderr).toContain(recovery);
    },
  );
});
