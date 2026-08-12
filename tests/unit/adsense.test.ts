import { describe, expect, it } from "vitest";

import {
  adsenseClientId,
  shouldLoadAdSense,
} from "../../src/presentation/adsense";

describe("AdSense placement policy", () => {
  it("uses the configured publisher account", () => {
    expect(adsenseClientId).toBe("ca-pub-3211121736772217");
  });

  it.each([
    "/online-reminder",
    "/email-reminder",
    "/zh/recurring-reminder",
    "/zh/deadline-reminder",
  ])("loads ads on public capability content: %s", (pathname) => {
    expect(shouldLoadAdSense(pathname)).toBe(true);
  });

  it.each([
    "/",
    "/about",
    "/privacy",
    "/contact",
    "/reminders",
    "/settings/email",
    "/manage/private-token",
    "/unsubscribe/private-token",
    "/auth/login",
    "/calendar/private-token",
  ])("does not load ads on operational or trust content: %s", (pathname) => {
    expect(shouldLoadAdSense(pathname)).toBe(false);
  });
});
