import { expect, test } from "@playwright/test";

test("public capability route stays within the launch timing and layout budget", async ({
  page,
}) => {
  await page.goto("/online-reminder", { waitUntil: "networkidle" });
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming;
    return {
      domReady: navigation.domContentLoadedEventEnd,
      horizontalOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  });
  expect(metrics.domReady).toBeLessThan(2500);
  expect(metrics.horizontalOverflow).toBe(0);
});
