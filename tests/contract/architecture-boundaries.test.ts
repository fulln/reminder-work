import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("architecture guard", () => {
  it("rejects a framework import from the domain", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/check-architecture.mjs", "tests/contract/fixtures/invalid"],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ARCH-DOMAIN-001");
    expect(result.stderr).toContain("bad-domain.ts");
  });
});
