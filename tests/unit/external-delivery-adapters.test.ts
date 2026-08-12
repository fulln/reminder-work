import { describe, expect, it, vi } from "vitest";

import {
  signWebhookPayload,
  SignedWebhookDeliveryAdapter,
} from "../../src/infrastructure/cloudflare/delivery/signed-webhook-adapter";
import { SlackDeliveryAdapter } from "../../src/infrastructure/cloudflare/delivery/slack-delivery-adapter";
import { SlackOAuthClient } from "../../src/infrastructure/cloudflare/slack/slack-oauth-client";

const event = {
  schemaVersion: 1 as const,
  event: "reminder.due" as const,
  idempotencyKey: "occurrence-1",
  occurredAt: "2026-08-12T01:00:00.000Z",
  reminder: {
    title: "Review launch plan",
    dueAt: "2026-08-12T01:00:00.000Z",
    manageUrl: "https://reminders.work/manage/token",
  },
};

describe("signed webhook delivery", () => {
  it("creates a stable v1 HMAC signature", async () => {
    await expect(
      signWebhookPayload("secret", "2026-08-12T01:00:00.000Z", '{"ok":true}'),
    ).resolves.toBe(
      "v1=b35404a0407ccde4cc32e78e45247afb0e1cf0c30926e1ab2f731b99e993beba",
    );
  });

  it("posts the exact body with verification headers", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    const adapter = new SignedWebhookDeliveryAdapter(fetcher);
    await adapter.send(
      {
        kind: "webhook",
        url: "https://hooks.example.com/reminders",
        signingSecret: "secret",
      },
      event,
    );
    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(init.body).toBe(JSON.stringify(event));
    expect(init.redirect).toBe("manual");
    expect(headers.get("X-Reminders-Event")).toBe("reminder.due");
    expect(headers.get("X-Reminders-Signature")).toMatch(/^v1=[a-f0-9]{64}$/);
  });

  it("revalidates stored URLs before every outbound request", async () => {
    const fetcher = vi.fn();
    const adapter = new SignedWebhookDeliveryAdapter(fetcher);
    await expect(
      adapter.send(
        {
          kind: "webhook",
          url: "https://127.0.0.1/reminders",
          signingSecret: "secret",
        },
        event,
      ),
    ).rejects.toMatchObject({
      code: "WEBHOOK_URL_REJECTED",
      retryable: false,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("Slack delivery", () => {
  it("uses OAuth incoming webhook credentials and includes a manage action", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("ok"));
    const adapter = new SlackDeliveryAdapter(fetcher);
    await adapter.send(
      {
        kind: "slack",
        webhookUrl: "https://hooks.slack.com/services/T/B/S",
        workspaceId: "T1",
        workspaceName: "Acme",
        channelId: "C1",
        channelName: "#ops",
      },
      event,
    );
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    if (typeof init.body !== "string") throw new Error("Slack body missing");
    expect(url).toBe("https://hooks.slack.com/services/T/B/S");
    expect(init.redirect).toBe("manual");
    expect(init.body).toContain("Open reminder");
    expect(init.body).toContain(event.reminder.manageUrl);
  });

  it("escapes Slack control syntax in reminder titles", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("ok"));
    const adapter = new SlackDeliveryAdapter(fetcher);
    await adapter.send(
      {
        kind: "slack",
        webhookUrl: "https://hooks.slack.com/services/T/B/S",
        workspaceId: "T1",
        workspaceName: "Acme",
        channelId: "C1",
        channelName: "#ops",
      },
      {
        ...event,
        reminder: { ...event.reminder, title: "Review <!channel> & ship" },
      },
    );
    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(init.body).toContain("&lt;!channel&gt; &amp; ship");
    expect(init.body).not.toContain("<!channel>");
  });

  it("never posts Slack content outside the official webhook origin", async () => {
    const fetcher = vi.fn();
    const adapter = new SlackDeliveryAdapter(fetcher);
    await expect(
      adapter.send(
        {
          kind: "slack",
          webhookUrl: "https://example.com/services/T/B/S",
          workspaceId: "T1",
          workspaceName: "Acme",
          channelId: "C1",
          channelName: "#ops",
        },
        event,
      ),
    ).rejects.toMatchObject({
      code: "SLACK_WEBHOOK_URL_INVALID",
      retryable: false,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("requests only incoming-webhook scope during OAuth", () => {
    const client = new SlackOAuthClient("client-id", "client-secret");
    const url = new URL(
      client.authorizationUrl({
        state: "state",
        redirectUri: "https://reminders.work/integrations/slack/callback",
      }),
    );
    expect(url.origin).toBe("https://slack.com");
    expect(url.searchParams.get("scope")).toBe("incoming-webhook");
    expect(url.searchParams.get("state")).toBe("state");
  });

  it("treats blank OAuth credentials as unavailable", () => {
    expect(new SlackOAuthClient("", "").available).toBe(false);
  });

  it("trims configured credentials before exchanging the OAuth code", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        ok: true,
        access_token: "token",
        team: { id: "T1", name: "Acme" },
        incoming_webhook: {
          url: "https://hooks.slack.com/services/T/B/S",
          channel: "#ops",
          channel_id: "C1",
        },
      }),
    );
    const client = new SlackOAuthClient(
      " client-id ",
      " client-secret ",
      fetcher,
    );

    await client.exchangeCode({
      code: "code",
      redirectUri: "https://reminders.work/integrations/slack/callback",
    });

    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    if (!(init.body instanceof URLSearchParams)) {
      throw new Error("Slack OAuth form body missing");
    }
    expect(init.body.get("client_id")).toBe("client-id");
    expect(init.body.get("client_secret")).toBe("client-secret");
  });
});
