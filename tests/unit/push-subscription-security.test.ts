import { describe, expect, it } from "vitest";

import { pushSubscriptionSchema } from "../../src/application/contracts/push-subscription";
import {
  decryptJson,
  encryptJson,
  keyedDigest,
  stableDigest,
} from "../../src/infrastructure/cloudflare/crypto/encrypted-json";

describe("push subscription boundary", () => {
  const subscription = {
    endpoint: "https://push.example.com/send/opaque",
    keys: { p256dh: "A".repeat(87), auth: "B".repeat(22) },
  };

  it("accepts public HTTPS push endpoints and rejects unsafe endpoints", () => {
    expect(pushSubscriptionSchema.safeParse(subscription).success).toBe(true);
    for (const endpoint of [
      "https://localhost/send/opaque",
      "https://app.localhost/send/opaque",
      "https://127.0.0.1/send/opaque",
      "https://10.0.0.1/send/opaque",
      "https://172.16.0.1/send/opaque",
      "https://192.168.1.1/send/opaque",
      "https://[::1]/send/opaque",
      "https://push.example.com:8443/send/opaque",
    ]) {
      expect(
        pushSubscriptionSchema.safeParse({ ...subscription, endpoint }).success,
        endpoint,
      ).toBe(false);
    }
  });

  it("encrypts endpoint and key material at rest", async () => {
    const ciphertext = await encryptJson(subscription, "test-key-material");
    expect(ciphertext).not.toContain(subscription.endpoint);
    expect(ciphertext).not.toContain(subscription.keys.p256dh);
    await expect(decryptJson(ciphertext, "test-key-material")).resolves.toEqual(
      subscription,
    );
  });

  it("uses a keyed digest for correlatable private identifiers", async () => {
    const value = "recipient@example.com";
    const first = await keyedDigest(value, "first-secret-key");
    const second = await keyedDigest(value, "second-secret-key");

    expect(first).not.toBe(await stableDigest(value));
    expect(first).not.toBe(second);
    expect(first).toBe(await keyedDigest(value, "first-secret-key"));
  });
});
