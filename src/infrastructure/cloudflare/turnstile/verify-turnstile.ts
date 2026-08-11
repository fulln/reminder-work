import type { TurnstilePort } from "../../../application/ports/turnstile";

export class LocalTurnstileAdapter implements TurnstilePort {
  constructor(private readonly appOrigin: string) {}

  verify(token: string): Promise<boolean> {
    return Promise.resolve(
      /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(this.appOrigin) &&
        token === "test-pass",
    );
  }
}

export class CloudflareTurnstileAdapter implements TurnstilePort {
  constructor(
    private readonly secret: string,
    private readonly expectedHostname: string,
  ) {}

  async verify(token: string, ipAddress?: string): Promise<boolean> {
    const body = new FormData();
    body.set("secret", this.secret);
    body.set("response", token);
    if (ipAddress !== undefined) body.set("remoteip", ipAddress);

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body },
    );
    if (!response.ok) return false;
    const result: unknown = await response.json();
    if (typeof result !== "object" || result === null) return false;
    return (
      "success" in result &&
      result.success === true &&
      "hostname" in result &&
      result.hostname === this.expectedHostname &&
      "action" in result &&
      result.action === "create_reminder"
    );
  }
}
