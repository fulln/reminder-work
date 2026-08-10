import { describe, expect, it } from "vitest";

import { LocalTurnstileAdapter } from "../../src/infrastructure/cloudflare/turnstile/verify-turnstile";

describe("create-reminder Cloudflare adapters", () => {
  it("accepts only the documented local Turnstile token without a production secret", async () => {
    const adapter = new LocalTurnstileAdapter("http://localhost:5173");
    await expect(adapter.verify("test-pass")).resolves.toBe(true);
    await expect(adapter.verify("anything-else")).resolves.toBe(false);
  });
});
