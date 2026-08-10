import { describe, expect, it } from "vitest";

import { formatScheduleReview } from "../../src/application/use-cases/review-reminder";
import { createSchedule } from "../../src/domain/reminder/create-schedule";

describe("formatScheduleReview", () => {
  it("always names the full IANA zone and UTC instant", () => {
    const schedule = createSchedule({
      localDate: "2026-08-11",
      localTime: "09:00",
      timeZone: "Asia/Shanghai",
    });
    const review = formatScheduleReview(schedule, "en");
    expect(review.local).toContain("09:00");
    expect(review.timeZone).toBe("Asia/Shanghai");
    expect(review.utc).toContain("UTC");
  });
});
