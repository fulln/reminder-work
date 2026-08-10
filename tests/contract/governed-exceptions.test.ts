import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("governed exceptions", () => {
  it("rejects expired and repository-wide exception scopes", () => {
    const result = spawnSync(
      process.execPath,
      [
        "scripts/check-governed-exceptions.mjs",
        "tests/contract/fixtures/exceptions",
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("GOVERNED-EXCEPTION-EXPIRED");
    expect(result.stderr).toContain("GOVERNED-EXCEPTION-SCOPE");
    expect(result.stderr).toContain("expired.json");
  });
});
