import {
  ExternalDeliveryError,
  type ExternalDeliveryEvent,
  type WebhookDeliveryPort,
} from "../../../application/ports/external-delivery";
import type { WebhookDestinationCredential } from "../../../application/ports/delivery-destination-repository";
import { normalizeOutboundWebhookUrl } from "../../../application/support/outbound-webhook-url";

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function signWebhookPayload(
  secret: string,
  timestamp: string,
  body: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return `v1=${hex(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${timestamp}.${body}`),
    ),
  )}`;
}

export class SignedWebhookDeliveryAdapter implements WebhookDeliveryPort {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async send(
    credential: WebhookDestinationCredential,
    event: ExternalDeliveryEvent,
  ): Promise<void> {
    const url = normalizeOutboundWebhookUrl(credential.url);
    if (url === null) {
      throw new ExternalDeliveryError("WEBHOOK_URL_REJECTED", false);
    }
    const body = JSON.stringify(event);
    const timestamp = event.occurredAt;
    let response: Response;
    try {
      response = await this.fetcher(url, {
        method: "POST",
        redirect: "error",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Reminders.work-Webhook/1.0",
          "X-Reminders-Event": event.event,
          "X-Reminders-Idempotency-Key": event.idempotencyKey,
          "X-Reminders-Timestamp": timestamp,
          "X-Reminders-Signature": await signWebhookPayload(
            credential.signingSecret,
            timestamp,
            body,
          ),
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ExternalDeliveryError("WEBHOOK_NETWORK_FAILED", true);
    }
    if (response.ok) return;
    const retryable =
      response.status === 408 ||
      response.status === 429 ||
      response.status >= 500;
    throw new ExternalDeliveryError(
      `WEBHOOK_HTTP_${String(response.status)}`,
      retryable,
    );
  }
}
