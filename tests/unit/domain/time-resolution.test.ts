import { describe, expect, it } from "vitest";

import {
  InvalidLocalTimeError,
  resolveLocalTime,
} from "../../../src/domain/time/resolve-local-time";

describe("resolveLocalTime", () => {
  it("resolves an IANA local time to one exact UTC instant", () => {
    const result = resolveLocalTime("2026-08-11", "09:00", "Asia/Shanghai");
    expect(result.instant).toBe("2026-08-11T01:00:00Z");
    expect(result.offset).toBe("+08:00");
  });

  it("rejects a daylight-saving gap", () => {
    expect(() =>
      resolveLocalTime("2026-03-08", "02:30", "America/New_York"),
    ).toThrow(InvalidLocalTimeError);
  });

  it("requires an explicit choice for a daylight-saving fold", () => {
    expect(() =>
      resolveLocalTime("2026-11-01", "01:30", "America/New_York"),
    ).toThrow(/occurs twice/);

    const earlier = resolveLocalTime(
      "2026-11-01",
      "01:30",
      "America/New_York",
      "earlier",
    );
    const later = resolveLocalTime(
      "2026-11-01",
      "01:30",
      "America/New_York",
      "later",
    );
    expect(earlier.instant).not.toBe(later.instant);
  });
});
