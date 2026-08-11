import { describe, expect, it } from "vitest";

import { LocalTurnstileAdapter } from "../../src/infrastructure/cloudflare/turnstile/verify-turnstile";

describe("LocalTurnstileAdapter", () => {
  it.each(["http://localhost:5173", "http://127.0.0.1:5173"])(
    "accepts the documented test token on %s",
    async (origin) => {
      await expect(
        new LocalTurnstileAdapter(origin).verify("test-pass"),
      ).resolves.toBe(true);
    },
  );

  it("never treats an HTTPS deployment as local", async () => {
    await expect(
      new LocalTurnstileAdapter("https://reminders.work").verify("test-pass"),
    ).resolves.toBe(false);
  });
});
