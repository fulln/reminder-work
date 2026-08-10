import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function createAndVerify(page: Page) {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Reminder", exact: true })
    .fill("Send launch brief");
  await page.getByLabel("Email address").fill("owner@example.com");
  await page.getByLabel("Date").fill("2026-08-11");
  await page.getByLabel("Time", { exact: true }).fill("09:00");
  await page.getByRole("button", { name: "Review reminder" }).click();
  await page.getByRole("button", { name: "Create reminder" }).click();
  await page
    .getByRole("link", { name: "Open local verification preview" })
    .click();
  await page.getByRole("button", { name: "Verify email" }).click();
}

test("completes an active reminder from its secure link", async ({ page }) => {
  await createAndVerify(page);
  await page.getByRole("link", { name: "Manage reminder" }).click();
  await expect(
    page.getByRole("heading", { name: "Send launch brief" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mark done" }).click();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark done" })).toHaveCount(0);
});

test("does not reveal details for invalid links", async ({ page }) => {
  await page.goto("/manage/not-a-valid-token");
  await expect(
    page.getByRole("heading", { name: "This link is unavailable" }),
  ).toBeVisible();
  await expect(page.getByText("Send launch brief")).toHaveCount(0);
});

test("keeps management usable at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await createAndVerify(page);
  await page.getByRole("link", { name: "Manage reminder" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
});
