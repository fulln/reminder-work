function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function encryptionKey(
  keyMaterial: string,
  usages: readonly KeyUsage[],
): Promise<CryptoKey> {
  const keyBytes = new TextEncoder().encode(
    keyMaterial.padEnd(32, "0").slice(0, 32),
  );
  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    usages,
  );
}

export async function encryptJson(
  value: unknown,
  keyMaterial: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(keyMaterial, ["encrypt"]),
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return `${toBase64(iv)}.${toBase64(new Uint8Array(encrypted))}`;
}

export async function decryptJson<T>(
  ciphertext: string,
  keyMaterial: string,
): Promise<T> {
  const [encodedIv, encodedPayload] = ciphertext.split(".");
  if (encodedIv === undefined || encodedPayload === undefined) {
    throw new Error("CIPHERTEXT_INVALID");
  }
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(encodedIv) },
    await encryptionKey(keyMaterial, ["decrypt"]),
    fromBase64(encodedPayload),
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

export async function stableDigest(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return toBase64(new Uint8Array(digest));
}
