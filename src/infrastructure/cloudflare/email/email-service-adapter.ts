import type {
  ReminderEmail,
  ReminderEmailPort,
  VerificationEmail,
  VerificationEmailPort,
} from "../../../application/ports/email-delivery";

export class CloudflareEmailServiceAdapter
  implements ReminderEmailPort, VerificationEmailPort
{
  constructor(
    private readonly binding: SendEmail,
    private readonly from: string,
  ) {}

  async sendReminder(message: ReminderEmail): Promise<void> {
    const introduction =
      "Someone used Reminders.work to schedule this transactional reminder.";
    await this.binding.send({
      from: { email: this.from, name: "Reminders.work" },
      to: [message.to],
      subject: `Reminder: ${message.title}`,
      text: `${message.title}\nDue: ${message.dueAt}\n\n${introduction}\nManage or stop this reminder: ${message.manageUrl}\nStop all future reminders to this address: ${message.unsubscribeUrl}`,
      html: `<h1>${escapeHtml(message.title)}</h1><p>Due: ${escapeHtml(message.dueAt)}</p><p>${introduction}</p><p><a href="${escapeHtml(message.manageUrl)}">Manage or stop this reminder</a></p><p><a href="${escapeHtml(message.unsubscribeUrl)}">Stop all future reminders to this address</a></p>`,
    });
  }

  async sendVerification(message: VerificationEmail): Promise<void> {
    await this.binding.send({
      from: { email: this.from, name: "Reminders.work" },
      to: [message.to],
      subject: "Verify your email to activate your reminder",
      text: `Verify your email: ${message.verificationUrl}\nThis link expires at ${message.expiresAt}.`,
      html: `<h1>Verify your email</h1><p><a href="${escapeHtml(message.verificationUrl)}">Activate your reminder</a></p><p>This link expires at ${escapeHtml(message.expiresAt)}.</p>`,
    });
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
