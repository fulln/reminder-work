import type { SlackOAuthPort } from "../../../application/ports/slack-oauth";
import type { SlackDestinationCredential } from "../../../application/ports/delivery-destination-repository";

interface SlackOAuthResponse {
  readonly ok?: boolean;
  readonly error?: string;
  readonly access_token?: string;
  readonly team?: { readonly id?: string; readonly name?: string };
  readonly incoming_webhook?: {
    readonly url?: string;
    readonly channel?: string;
    readonly channel_id?: string;
  };
}

export class SlackOAuthExchangeError extends Error {
  constructor(readonly reason: string) {
    super("Slack OAuth exchange failed.");
    this.name = "SlackOAuthExchangeError";
  }
}

export class SlackOAuthClient implements SlackOAuthPort {
  readonly available: boolean;

  constructor(
    private readonly clientId: string | undefined,
    private readonly clientSecret: string | undefined,
    private readonly fetcher: typeof fetch = (input, init) =>
      fetch(input, init),
  ) {
    this.available =
      clientId !== undefined &&
      clientId.trim() !== "" &&
      clientSecret !== undefined &&
      clientSecret.trim() !== "";
  }

  authorizationUrl(input: {
    readonly state: string;
    readonly redirectUri: string;
  }): string {
    if (!this.available || this.clientId === undefined) {
      throw new Error("SLACK_NOT_CONFIGURED");
    }
    const url = new URL("https://slack.com/oauth/v2/authorize");
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("scope", "incoming-webhook");
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("state", input.state);
    return url.toString();
  }

  async exchangeCode(input: {
    readonly code: string;
    readonly redirectUri: string;
  }): Promise<SlackDestinationCredential> {
    if (
      !this.available ||
      this.clientId === undefined ||
      this.clientSecret === undefined
    ) {
      throw new Error("SLACK_NOT_CONFIGURED");
    }
    const body = new URLSearchParams({
      client_id: this.clientId.trim(),
      client_secret: this.clientSecret.trim(),
      code: input.code,
      redirect_uri: input.redirectUri,
    });
    const response = await this.fetcher(
      "https://slack.com/api/oauth.v2.access",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(10_000),
      },
    );
    const payload: SlackOAuthResponse = await response.json();
    const webhook = payload.incoming_webhook;
    if (
      !response.ok ||
      payload.ok !== true ||
      payload.team?.id === undefined ||
      webhook?.url === undefined ||
      webhook.channel_id === undefined
    ) {
      throw new SlackOAuthExchangeError(
        payload.error ?? `http_${String(response.status)}`,
      );
    }
    const webhookUrl = new URL(webhook.url);
    if (
      webhookUrl.protocol !== "https:" ||
      webhookUrl.origin !== "https://hooks.slack.com" ||
      !webhookUrl.pathname.startsWith("/services/")
    ) {
      throw new Error("SLACK_WEBHOOK_URL_INVALID");
    }
    return {
      kind: "slack",
      webhookUrl: webhookUrl.toString(),
      workspaceId: payload.team.id,
      workspaceName: payload.team.name ?? "Slack workspace",
      channelId: webhook.channel_id,
      channelName: webhook.channel ?? "Slack channel",
      ...(payload.access_token === undefined
        ? {}
        : { accessToken: payload.access_token }),
    };
  }

  async revoke(accessToken: string): Promise<void> {
    await this.fetcher("https://slack.com/api/auth.revoke", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      signal: AbortSignal.timeout(10_000),
    });
  }
}
