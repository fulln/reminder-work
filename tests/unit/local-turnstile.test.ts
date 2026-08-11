import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CloudflareTurnstileAdapter,
  LocalTurnstileAdapter,
} from "../../src/infrastructure/cloudflare/turnstile/verify-turnstile";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

describe("CloudflareTurnstileAdapter", () => {
  it("accepts only a successful token for the expected hostname and action", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          hostname: "reminders.work",
          action: "create_reminder",
        }),
        { headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new CloudflareTurnstileAdapter("secret", "reminders.work");
    await expect(adapter.verify("browser-token")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    { hostname: "evil.example", action: "create_reminder" },
    { hostname: "reminders.work", action: "different_action" },
  ])("rejects a mismatched Siteverify response", async (result) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true, ...result }), {
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const adapter = new CloudflareTurnstileAdapter("secret", "reminders.work");
    await expect(adapter.verify("browser-token")).resolves.toBe(false);
  });
});
