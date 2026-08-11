import { expect, test } from "@playwright/test";

test("sends sign in to the centralized authentication service", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("a.wordmark")).toHaveText("Reminders.work");
  const signIn = page.getByRole("link", { name: "Sign in" });
  const href = await signIn.getAttribute("href");
  if (href === null)
    throw new Error("Sign in link is missing its destination.");

  const authUrl = new URL(href);
  expect(authUrl.origin).toBe("https://auth.elemvisual.com");
  expect(authUrl.pathname).toBe("/auth/login");
  expect(authUrl.searchParams.get("site")).toBe("reminder-work");
  expect(authUrl.searchParams.get("return_to")).toBe(
    "http://127.0.0.1:5173/auth/callback",
  );
});
