import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("contract version guard", () => {
  it("rejects an asynchronous or persisted message without a schema version", () => {
    const result = spawnSync(
      process.execPath,
      [
        "scripts/check-contract-versions.mjs",
        "tests/contract/fixtures/invalid",
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("CONTRACT-VERSION-001");
    expect(result.stderr).toContain("unversioned-message.ts");
  });
});
