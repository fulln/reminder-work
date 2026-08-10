import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function revealScheduleDetails(page: Page) {
  const toggle = page.getByRole("button", { name: /Schedule details/ });
  if (!(await toggle.isVisible())) return;

  await expect(async () => {
    if ((await toggle.getAttribute("aria-expanded")) !== "true") {
      await toggle.click();
    }

    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  }).toPass();
}

test("reviews exact time then reaches email verification", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Set it once",
  );
  await page
    .getByRole("textbox", { name: "Reminder", exact: true })
    .fill("Prepare launch notes");
  await page.getByLabel("Email address").fill("owner@example.com");
  await page.getByLabel("Date").fill("2026-08-11");
  await page.getByLabel("Time", { exact: true }).fill("09:00");
  await revealScheduleDetails(page);
  await page
    .getByLabel("Time zone", { exact: true })
    .selectOption("Asia/Shanghai");
  await page.getByRole("button", { name: "Review reminder" }).click();

  await expect(page.getByText("Asia/Shanghai", { exact: true })).toBeVisible();
  await expect(page.getByText(/01:00.*UTC/)).toBeVisible();
  await page.getByRole("button", { name: "Create reminder" }).click();
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Open local verification preview" })
    .click();
  await page.getByRole("button", { name: "Verify email" }).click();
  await expect(
    page.getByRole("heading", { name: "Reminder activated" }),
  ).toBeVisible();
});

test("moves focus to actionable validation feedback", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Review reminder" }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toBeVisible();
  await expect(alert).toBeFocused();
  await expect(
    page.getByText("Enter what you want to remember."),
  ).toBeVisible();
});

test("keeps public purpose and labels in server HTML", async ({ request }) => {
  const response = await request.get("/");
  const html = await response.text();
  expect(html).toContain("Free online reminders");
  expect(html).toContain("Email address");
  expect(html).toContain("Review reminder");
});
