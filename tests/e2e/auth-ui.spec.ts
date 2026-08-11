import { expect, test } from "@playwright/test";

test("offers a first-party Google and GitHub sign-in surface", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.locator("a.wordmark")).toHaveText("Reminders.work");
  await page.getByRole("link", { name: "Sign in" }).click();

  await expect(
    page.getByRole("heading", { name: "Continue to Reminders.work" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with GitHub" }),
  ).toBeVisible();

  const html = await (await request.get("/auth/login")).text();
  expect(html).toContain('name="robots" content="noindex, nofollow"');
  expect(html).not.toContain("session_token");
});
