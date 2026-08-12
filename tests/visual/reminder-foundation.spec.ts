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

test("captures on-device understanding and system calendar handoff", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, "LanguageModel", {
      configurable: true,
      value: {
        availability: () => Promise.resolve("available"),
        create: () =>
          Promise.resolve({
            prompt: () =>
              Promise.resolve(
                JSON.stringify({
                  normalizedText: "Call Jordan on 2030-08-20 at 09:00",
                }),
              ),
          }),
      },
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: () => Promise.resolve(),
    });
  });

  await page.goto("/");
  await page
    .getByRole("textbox", { name: "What should we remind you about?" })
    .fill("Please untangle this reminder for Jordan");
  await page.getByRole("button", { name: "Set date & time" }).click();
  await expect(page.getByText(/Understood · On-device AI/)).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("quick-ai.png"),
    fullPage: true,
  });

  await page.getByLabel("Email address").fill("owner@example.com");
  await page.getByRole("button", { name: "Review reminder" }).click();
  await expect(
    page.getByRole("button", { name: "Add this reminder once" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("calendar-share.png"),
    fullPage: true,
  });
});
