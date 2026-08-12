import { describe, expect, it } from "vitest";

import { CloudflareEmailServiceAdapter } from "../../src/infrastructure/cloudflare/email/email-service-adapter";

describe("CloudflareEmailServiceAdapter", () => {
  it("separates single-reminder management from recipient-wide opt-out", async () => {
    const sent: EmailMessageBuilder[] = [];
    const binding: SendEmail = {
      send(message: EmailMessage | EmailMessageBuilder) {
        if ("subject" in message) sent.push(message);
        return Promise.resolve({ messageId: "message-1" });
      },
    };
    const adapter = new CloudflareEmailServiceAdapter(
      binding,
      "reminders@reminders.work",
    );

    await adapter.sendReminder({
      to: "recipient@example.com",
      title: '<Review "launch">',
      dueAt: "2026-08-12T10:00:00.000Z",
      manageUrl: "https://reminders.work/manage/manage-token",
      unsubscribeUrl: "https://reminders.work/unsubscribe/unsubscribe-token",
    });

    expect(sent[0]?.text).toContain("Manage or stop this reminder:");
    expect(sent[0]?.text).toContain(
      "Stop all future reminders to this address:",
    );
    expect(sent[0]?.html).toContain("&lt;Review &quot;launch&quot;&gt;");
    expect(sent[0]?.html).toContain(
      "Stop all future reminders to this address",
    );
  });

  it("sends an escaped verification link through the email binding", async () => {
    const sent: EmailMessageBuilder[] = [];
    const binding: SendEmail = {
      send(message: EmailMessage | EmailMessageBuilder) {
        if ("subject" in message) sent.push(message);
        return Promise.resolve({ messageId: "message-1" });
      },
    };
    const adapter = new CloudflareEmailServiceAdapter(
      binding,
      "reminders@reminders.work",
    );

    await adapter.sendVerification({
      to: "owner@example.com",
      verificationUrl:
        'https://reminders.work/verify/token?next="unsafe"&source=email',
      expiresAt: "2026-08-10T10:30:00.000Z",
    });

    expect(sent).toEqual([
      {
        from: {
          email: "reminders@reminders.work",
          name: "Reminders.work",
        },
        to: ["owner@example.com"],
        subject: "Verify your email to activate your reminder",
        text: 'Verify your email: https://reminders.work/verify/token?next="unsafe"&source=email\nThis link expires at 2026-08-10T10:30:00.000Z.',
        html: '<h1>Verify your email</h1><p><a href="https://reminders.work/verify/token?next=&quot;unsafe&quot;&amp;source=email">Activate your reminder</a></p><p>This link expires at 2026-08-10T10:30:00.000Z.</p>',
      },
    ]);
  });
});
