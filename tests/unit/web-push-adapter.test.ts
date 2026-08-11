import { describe, expect, it, vi } from "vitest";

import { CloudflareWebPushAdapter } from "../../src/infrastructure/cloudflare/web-push/web-push-adapter";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function combine(...parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const output = new Uint8Array(
    parts.reduce((length, part) => length + part.byteLength, 0),
  );
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

async function hkdf(
  inputKeyMaterial: Uint8Array<ArrayBuffer>,
  salt: Uint8Array<ArrayBuffer>,
  info: Uint8Array<ArrayBuffer>,
  lengthBytes: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey(
    "raw",
    inputKeyMaterial,
    "HKDF",
    false,
    ["deriveBits"],
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info },
      key,
      lengthBytes * 8,
    ),
  );
}

async function decryptPushBody(
  body: Uint8Array<ArrayBuffer>,
  clientKeys: CryptoKeyPair,
  clientPublic: Uint8Array<ArrayBuffer>,
  auth: Uint8Array<ArrayBuffer>,
): Promise<string> {
  const salt = body.slice(0, 16);
  const publicKeyLength = body[20] ?? 0;
  const serverPublic = body.slice(21, 21 + publicKeyLength);
  const encrypted = body.slice(21 + publicKeyLength);
  const importedServerKey = await crypto.subtle.importKey(
    "raw",
    serverPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: importedServerKey },
      clientKeys.privateKey,
      256,
    ),
  );
  const inputKeyMaterial = await hkdf(
    sharedSecret,
    auth,
    combine(encoder.encode("WebPush: info\0"), clientPublic, serverPublic),
    32,
  );
  const contentEncryptionKey = await hkdf(
    inputKeyMaterial,
    salt,
    encoder.encode("Content-Encoding: aes128gcm\0"),
    16,
  );
  const nonce = await hkdf(
    inputKeyMaterial,
    salt,
    encoder.encode("Content-Encoding: nonce\0"),
    12,
  );
  const key = await crypto.subtle.importKey(
    "raw",
    contentEncryptionKey,
    "AES-GCM",
    false,
    ["decrypt"],
  );
  const plaintext = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, encrypted),
  );
  expect(plaintext.at(-1)).toBe(2);
  return decoder.decode(plaintext.slice(0, -1));
}

describe("CloudflareWebPushAdapter", () => {
  async function fixture(status: number) {
    const vapidKeys = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    );
    const vapidPublic = new Uint8Array(
      await crypto.subtle.exportKey("raw", vapidKeys.publicKey),
    );
    const vapidPrivate = await crypto.subtle.exportKey(
      "jwk",
      vapidKeys.privateKey,
    );
    const clientKeys = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    );
    const clientPublic = new Uint8Array(
      await crypto.subtle.exportKey("raw", clientKeys.publicKey),
    );
    const auth = crypto.getRandomValues(new Uint8Array(16));
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status }));
    const adapter = new CloudflareWebPushAdapter({
      publicKey: base64Url(vapidPublic),
      privateKey: vapidPrivate.d ?? "",
      subject: "mailto:support@reminders.work",
      fetcher,
      now: () => new Date("2026-08-11T00:00:00.000Z"),
    });
    return {
      adapter,
      auth,
      clientKeys,
      clientPublic,
      fetcher,
      subscription: {
        id: "push-1",
        endpoint: "https://push.example.com/send/1",
        keys: {
          p256dh: base64Url(clientPublic),
          auth: base64Url(auth),
        },
      },
    };
  }

  const notification = {
    title: "Reminder due",
    body: "Open Reminders.work to view and manage it.",
    url: "https://reminders.work/manage/opaque",
    tag: "reminder-1",
  };

  it("encrypts a notification and sends a VAPID-authenticated request", async () => {
    const { adapter, auth, clientKeys, clientPublic, fetcher, subscription } =
      await fixture(201);

    await expect(adapter.send(subscription, notification)).resolves.toBe(
      "sent",
    );

    expect(fetcher).toHaveBeenCalledOnce();
    const [endpoint, request] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(endpoint).toBe("https://push.example.com/send/1");
    expect(new Headers(request.headers).get("Content-Encoding")).toBe(
      "aes128gcm",
    );
    expect(new Headers(request.headers).get("Authorization")).toMatch(
      /^vapid t=.+, k=.+/u,
    );
    const body = request.body as Uint8Array<ArrayBuffer>;
    expect(body.byteLength).toBeGreaterThan(100);
    await expect(
      decryptPushBody(body, clientKeys, clientPublic, auth),
    ).resolves.toBe(JSON.stringify(notification));
  });

  it("classifies expired endpoints without retrying them", async () => {
    const { adapter, subscription } = await fixture(410);
    await expect(adapter.send(subscription, notification)).resolves.toBe(
      "gone",
    );
  });
});
