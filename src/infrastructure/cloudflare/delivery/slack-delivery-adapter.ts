import {
  ExternalDeliveryError,
  type ExternalDeliveryEvent,
  type SlackDeliveryPort,
} from "../../../application/ports/external-delivery";
import type { SlackDestinationCredential } from "../../../application/ports/delivery-destination-repository";

function escapeSlackText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function isSlackWebhookUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.origin === "https://hooks.slack.com" &&
      url.pathname.startsWith("/services/")
    );
  } catch {
    return false;
  }
}

export class SlackDeliveryAdapter implements SlackDeliveryPort {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async send(
    credential: SlackDestinationCredential,
    event: ExternalDeliveryEvent,
  ): Promise<void> {
    if (!isSlackWebhookUrl(credential.webhookUrl)) {
      throw new ExternalDeliveryError("SLACK_WEBHOOK_URL_INVALID", false);
    }
    const title = escapeSlackText(event.reminder.title);
    let response: Response;
    try {
      response = await this.fetcher(credential.webhookUrl, {
        method: "POST",
        redirect: "error",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `${title} — due now`,
          blocks: [
            {
              type: "header",
              text: { type: "plain_text", text: "Reminder due" },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*${title}*\nDue ${event.reminder.dueAt}`,
              },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "Open reminder" },
                  url: event.reminder.manageUrl,
                  action_id: "open_reminder",
                },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ExternalDeliveryError("SLACK_NETWORK_FAILED", true);
    }
    if (response.ok) return;
    const retryable = response.status === 429 || response.status >= 500;
    throw new ExternalDeliveryError(
      `SLACK_HTTP_${String(response.status)}`,
      retryable,
    );
  }
}
