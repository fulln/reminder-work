import type {
  WebPushDeliveryPort,
  WebPushDeliveryResult,
  WebPushNotification,
} from "../../../application/ports/web-push-delivery";
import type { StoredPushSubscription } from "../../../application/ports/push-subscription-repository";

const encoder = new TextEncoder();

function encodeBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }
  return output;
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
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    lengthBytes * 8,
  );
  return new Uint8Array(bits);
}

export interface EncryptedWebPushPayload {
  readonly body: Uint8Array<ArrayBuffer>;
  readonly serverPublicKey: Uint8Array<ArrayBuffer>;
}

export async function encryptWebPushPayload(
  payload: string,
  clientPublicKey: string,
  authSecret: string,
): Promise<EncryptedWebPushPayload> {
  const userAgentPublicKey = decodeBase64Url(clientPublicKey);
  const auth = decodeBase64Url(authSecret);
  if (userAgentPublicKey.byteLength !== 65 || auth.byteLength !== 16) {
    throw new Error("PUSH_SUBSCRIPTION_KEYS_INVALID");
  }

  const importedClientKey = await crypto.subtle.importKey(
    "raw",
    userAgentPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const serverKeys = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: importedClientKey },
      serverKeys.privateKey,
      256,
    ),
  );
  const serverPublicKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeys.publicKey),
  );
  const keyInfo = combine(
    encoder.encode("WebPush: info\0"),
    userAgentPublicKey,
    serverPublicKey,
  );
  const inputKeyMaterial = await hkdf(sharedSecret, auth, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
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
  const plaintext = combine(encoder.encode(payload), new Uint8Array([2]));
  const key = await crypto.subtle.importKey(
    "raw",
    contentEncryptionKey,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, plaintext),
  );
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096);
  const body = combine(
    salt,
    recordSize,
    new Uint8Array([serverPublicKey.byteLength]),
    serverPublicKey,
    encrypted,
  );
  return { body, serverPublicKey };
}

async function createVapidAuthorization(
  endpoint: string,
  publicKey: string,
  privateKey: string,
  subject: string,
  now: Date,
): Promise<string> {
  const publicBytes = decodeBase64Url(publicKey);
  const privateBytes = decodeBase64Url(privateKey);
  if (
    publicBytes.byteLength !== 65 ||
    publicBytes[0] !== 4 ||
    privateBytes.byteLength !== 32
  ) {
    throw new Error("VAPID_KEY_INVALID");
  }
  if (!subject.startsWith("mailto:") && !subject.startsWith("https://")) {
    throw new Error("VAPID_SUBJECT_INVALID");
  }
  const header = encodeBase64Url(
    encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })),
  );
  const payload = encodeBase64Url(
    encoder.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(now.getTime() / 1000) + 12 * 60 * 60,
        sub: subject,
      }),
    ),
  );
  const signingInput = `${header}.${payload}`;
  const signingKey = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: encodeBase64Url(publicBytes.slice(1, 33)),
      y: encodeBase64Url(publicBytes.slice(33, 65)),
      d: encodeBase64Url(privateBytes),
      ext: false,
      key_ops: ["sign"],
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      signingKey,
      encoder.encode(signingInput),
    ),
  );
  return `vapid t=${signingInput}.${encodeBase64Url(signature)}, k=${publicKey}`;
}

export class CloudflareWebPushAdapter implements WebPushDeliveryPort {
  constructor(
    private readonly configuration: {
      readonly publicKey: string;
      readonly privateKey: string;
      readonly subject: string;
      readonly fetcher?: (
        input: string,
        init: RequestInit,
      ) => Promise<Response>;
      readonly now?: () => Date;
    },
  ) {}

  async send(
    subscription: StoredPushSubscription,
    notification: WebPushNotification,
  ): Promise<WebPushDeliveryResult> {
    const encrypted = await encryptWebPushPayload(
      JSON.stringify(notification),
      subscription.keys.p256dh,
      subscription.keys.auth,
    );
    const authorization = await createVapidAuthorization(
      subscription.endpoint,
      this.configuration.publicKey,
      this.configuration.privateKey,
      this.configuration.subject,
      this.configuration.now?.() ?? new Date(),
    );
    const response = await (this.configuration.fetcher ?? fetch)(
      subscription.endpoint,
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Encoding": "aes128gcm",
          "Content-Type": "application/octet-stream",
          TTL: "300",
          Urgency: "high",
        },
        body: encrypted.body,
      },
    );
    if (response.ok) return "sent";
    if (response.status === 404 || response.status === 410) return "gone";
    throw new Error(`WEB_PUSH_REJECTED:${String(response.status)}`);
  }
}
