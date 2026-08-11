import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

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
    .getByRole("textbox", { name: "What should we remind you about?" })
    .fill("Prepare launch notes on 2026-08-20 at 9am");
  await page.getByRole("button", { name: "Set date & time" }).click();
  await expect(page.getByText("Understood", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Email/ })).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: /This browser/ }),
  ).not.toBeChecked();
  await page.getByLabel("Email address").fill("owner@example.com");
  await revealScheduleDetails(page);
  await page
    .getByLabel("Time zone", { exact: true })
    .selectOption("Asia/Shanghai");
  await expect(page.getByText("04 · Security", { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Review reminder" }).click();

  await expect(page.getByText("Asia/Shanghai", { exact: true })).toBeVisible();
  await expect(page.getByText(/01:00.*UTC/)).toBeVisible();
  await expect(page.getByText("04 · Security", { exact: true })).toBeVisible();
  await expect(page.getByText("Security check complete.")).toBeVisible();
  const calendarDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Add to calendar" }).click();
  const calendar = await calendarDownload;
  expect(calendar.suggestedFilename()).toBe("reminder.ics");
  const calendarPath = await calendar.path();
  expect(await readFile(calendarPath, "utf8")).toContain(
    "DTSTART;TZID=Asia/Shanghai:20260820T090000",
  );
  await page.getByRole("button", { name: "Create reminder" }).click();
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add to calendar" }),
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
  await page
    .getByRole("button", { name: "Choose date & time manually" })
    .click();
  await page.getByRole("button", { name: "Review reminder" }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toBeVisible();
  await expect(alert).toBeFocused();
  await expect(
    page.getByText("Enter what you want to remember."),
  ).toBeVisible();
});

test("keeps quick and manual entry as mutually exclusive modes", async ({
  page,
}) => {
  await page.goto("/");

  const quickInput = page.getByRole("textbox", {
    name: "What should we remind you about?",
  });
  const manualInput = page.getByRole("textbox", {
    name: "Reminder",
    exact: true,
  });

  await expect(quickInput).toBeVisible();
  await expect(manualInput).toBeHidden();

  await page
    .getByRole("button", { name: "Choose date & time manually" })
    .click();
  await expect(quickInput).toBeHidden();
  await expect(manualInput).toBeVisible();

  await page.getByRole("button", { name: "Use quick create" }).click();
  await expect(quickInput).toBeVisible();
  await expect(manualInput).toBeHidden();
});

test("enables this browser explicitly and creates a push-only reminder", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const browserState = window as Window & {
      __notificationPermissionRequests?: number;
      __testNotifications?: number;
    };
    browserState.__notificationPermissionRequests = 0;
    browserState.__testNotifications = 0;
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: {
        permission: "default",
        requestPermission: () => {
          browserState.__notificationPermissionRequests =
            (browserState.__notificationPermissionRequests ?? 0) + 1;
          return Promise.resolve("granted");
        },
      },
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: true,
    });
    const subscription = {
      toJSON: () => ({
        endpoint: "https://push.example.com/send/browser-test",
        keys: { p256dh: "A".repeat(87), auth: "B".repeat(22) },
      }),
    };
    const registration = {
      pushManager: {
        getSubscription: () => Promise.resolve(null),
        subscribe: () => Promise.resolve(subscription),
      },
      showNotification: () => {
        browserState.__testNotifications =
          (browserState.__testNotifications ?? 0) + 1;
        return Promise.resolve();
      },
    };
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register: () => Promise.resolve(registration),
        ready: Promise.resolve(registration),
      },
    });
  });

  await page.goto("/");
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __notificationPermissionRequests?: number })
          .__notificationPermissionRequests,
    ),
  ).toBe(0);
  await page
    .getByRole("textbox", { name: "What should we remind you about?" })
    .fill("Review the launch notes on 2026-08-20 at 9am");
  await page.getByRole("button", { name: "Set date & time" }).click();
  await page.getByRole("checkbox", { name: /This browser/ }).check();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(
    page.getByText("Backup when browser delivery is unavailable"),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: /Email/ }).uncheck();
  await expect(page.getByLabel("Email address")).toBeHidden();
  await page
    .getByRole("button", { name: "Enable browser notifications" })
    .click();
  await expect(page.getByText("Browser notifications enabled")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __notificationPermissionRequests?: number })
          .__notificationPermissionRequests,
    ),
  ).toBe(1);
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __testNotifications?: number })
          .__testNotifications,
    ),
  ).toBe(1);

  await page.getByRole("button", { name: "Review reminder" }).click();
  await expect(
    page.getByText("Browser notification", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create reminder" }).click();
  await expect(
    page.getByRole("heading", { name: "This browser will remind you" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Manage reminder" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add to calendar" }),
  ).toBeVisible();
});

test("keeps public purpose and labels in server HTML", async ({ request }) => {
  const response = await request.get("/");
  const html = await response.text();
  expect(html).toContain("Free online reminders");
  expect(html).toContain("What should we remind you about?");
  expect(html).toContain("Choose date &amp; time manually");
});
