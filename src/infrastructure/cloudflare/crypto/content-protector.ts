import type {
  ContentProtector,
  ProtectedContent,
} from "../../../application/ports/content-protector";
import {
  decryptJson,
  encryptJson,
  keyedDigest,
  stableDigest,
} from "./encrypted-json";

export class WebCryptoContentProtector implements ContentProtector {
  constructor(private readonly keyMaterial: string) {}

  async protect(
    title: string,
    recipientEmail: string | undefined,
    recipientIdentity: string,
  ): Promise<ProtectedContent> {
    return {
      recipientRef: await keyedDigest(recipientIdentity, this.keyMaterial),
      legacyRecipientRef: await stableDigest(recipientIdentity),
      ciphertext: await encryptJson(
        {
          title,
          ...(recipientEmail === undefined ? {} : { recipientEmail }),
        },
        this.keyMaterial,
      ),
    };
  }

  async unprotect(ciphertext: string) {
    return decryptJson<{ title: string; recipientEmail?: string }>(
      ciphertext,
      this.keyMaterial,
    );
  }
}
