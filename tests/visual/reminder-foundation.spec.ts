import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("captures accessible focus, reduced motion, pending, error, and success states", async ({
  page,
}, testInfo) => {
  await page.goto("/online-reminder");
  const results = await new AxeBuilder({ page })
    .disableRules(["color-contrast"])
    .analyze();
  expect(
    results.violations.filter(
      (violation) =>
        violation.impact === "critical" || violation.impact === "serious",
    ),
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("default.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Review reminder" }).focus();
  await page.screenshot({
    path: testInfo.outputPath("focus.png"),
    fullPage: true,
  });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.screenshot({
    path: testInfo.outputPath("reduced-motion.png"),
    fullPage: true,
  });

  await page.getByRole("textbox", { name: "Reminder", exact: true }).fill("");
  await page.getByRole("button", { name: "Review reminder" }).click();
  await expect(page.getByRole("alert")).toBeFocused();
  await page.screenshot({
    path: testInfo.outputPath("error.png"),
    fullPage: true,
  });

  await page
    .getByRole("textbox", { name: "Reminder", exact: true })
    .fill("Review launch readiness");
  await page.getByLabel("Email address").fill("owner@example.com");
  await page.getByLabel("Date").fill("2026-08-11");
  await page.getByLabel("Time", { exact: true }).fill("09:00");
  const review = page.getByRole("button", { name: "Review reminder" });
  await review.evaluate((button) => {
    button.setAttribute("aria-busy", "true");
    button.setAttribute("disabled", "");
    button.textContent = "Resolving exact time…";
  });
  const pendingButton = page.getByRole("button", {
    name: "Resolving exact time…",
  });
  await expect(pendingButton).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("pending.png"),
    fullPage: true,
  });
  await pendingButton.evaluate((button) => {
    button.removeAttribute("aria-busy");
    button.removeAttribute("disabled");
    button.textContent = "Review reminder";
  });
  await review.click();
  await expect(
    page.getByRole("heading", { name: "Confirm this reminder" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("success.png"),
    fullPage: true,
  });
});
