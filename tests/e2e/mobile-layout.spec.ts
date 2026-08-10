import { expect, test, type Page } from "@playwright/test";

async function expandScheduleDetails(page: Page) {
  const toggle = page.getByRole("button", { name: /Schedule details/ });

  await expect(async () => {
    if ((await toggle.getAttribute("aria-expanded")) !== "true") {
      await toggle.click();
    }

    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  }).toPass();
}

test("uses a task-first mobile layout instead of shrinking the desktop composition", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");

  await page.goto("/");

  await expect(
    page.getByText("What needs remembering?", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Set it once. Return when it matters.", { exact: true }),
  ).toBeHidden();

  const date = await page.getByLabel("Date").boundingBox();
  const time = await page.getByLabel("Time", { exact: true }).boundingBox();
  expect(date).not.toBeNull();
  expect(time).not.toBeNull();
  expect(Math.abs((date?.y ?? 0) - (time?.y ?? 0))).toBeLessThan(8);

  await expect(page.getByLabel("Time zone", { exact: true })).toBeHidden();
  await expandScheduleDetails(page);
  await expect(page.getByLabel("Time zone", { exact: true })).toBeVisible();

  const review = page.getByRole("button", { name: "Review reminder" });
  await expect(review).toBeVisible();
  await expect(review.locator("..")).toHaveCSS("position", "fixed");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
});

test("keeps the complete desktop composition visible", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium");

  await page.goto("/");
  await expect(
    page.getByText("Set it once. Return when it matters.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("What needs remembering?", { exact: true }),
  ).toBeHidden();
  await expect(page.getByLabel("Time zone", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Schedule details", { exact: true }),
  ).toBeHidden();
});
