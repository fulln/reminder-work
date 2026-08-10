import type {
  ContentProtector,
  ProtectedContent,
} from "../../../application/ports/content-protector";

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

export class WebCryptoContentProtector implements ContentProtector {
  constructor(private readonly keyMaterial: string) {}

  async protect(
    title: string,
    recipientEmail: string,
  ): Promise<ProtectedContent> {
    const keyBytes = new TextEncoder().encode(
      this.keyMaterial.padEnd(32, "0").slice(0, 32),
    );
    const encryptionKey = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    );
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(recipientEmail),
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(
      JSON.stringify({ title, recipientEmail }),
    );
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      encryptionKey,
      plaintext,
    );

    return {
      recipientRef: toBase64(new Uint8Array(digest)),
      ciphertext: `${toBase64(iv)}.${toBase64(new Uint8Array(encrypted))}`,
    };
  }

  async unprotect(ciphertext: string) {
    const [encodedIv, encodedPayload] = ciphertext.split(".");
    if (encodedIv === undefined || encodedPayload === undefined) {
      throw new Error("CONTENT_CIPHERTEXT_INVALID");
    }
    const keyBytes = new TextEncoder().encode(
      this.keyMaterial.padEnd(32, "0").slice(0, 32),
    );
    const encryptionKey = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(encodedIv) },
      encryptionKey,
      fromBase64(encodedPayload),
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as {
      title: string;
      recipientEmail: string;
    };
  }
}
