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

const slugs = [
  "online-reminder",
  "email-reminder",
  "recurring-reminder",
  "meeting-reminder",
  "deadline-reminder",
  "follow-up-reminder",
] as const;

for (const slug of slugs) {
  test(`${slug} has differentiated English and Chinese server content`, async ({
    page,
    request,
  }) => {
    await page.goto(`/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Reminder", exact: true }),
    ).toBeVisible();
    const english = await (await request.get(`/${slug}`)).text();
    const chinese = await (await request.get(`/zh/${slug}`)).text();
    expect(english).toContain('rel="canonical"');
    expect(english).toContain('hrefLang="zh-CN"');
    expect(chinese).toContain('lang="zh-CN"');
    expect(chinese).not.toBe(english);
  });
}

test("recurring and deadline pages expose their real controls", async ({
  page,
}, testInfo) => {
  await page.goto("/recurring-reminder");
  if (testInfo.project.name === "mobile") {
    await expandScheduleDetails(page);
  }
  await expect(page.getByLabel("Repeat schedule")).toBeVisible();
  await page.goto("/deadline-reminder");
  if (testInfo.project.name === "mobile") {
    await expandScheduleDetails(page);
  }
  await expect(
    page.getByText("Reminder lead times", { exact: true }),
  ).toBeVisible();
});
