export interface ReminderEmail {
  readonly to: string;
  readonly title: string;
  readonly dueAt: string;
  readonly manageUrl: string;
  readonly unsubscribeUrl: string;
}

export interface ReminderEmailPort {
  sendReminder(message: ReminderEmail): Promise<void>;
}

export class CloudflareEmailServiceAdapter implements ReminderEmailPort {
  constructor(
    private readonly binding: SendEmail,
    private readonly from: string,
  ) {}

  async sendReminder(message: ReminderEmail): Promise<void> {
    await this.binding.send({
      from: { email: this.from, name: "Reminders.work" },
      to: [message.to],
      subject: `Reminder: ${message.title}`,
      text: `${message.title}\nDue: ${message.dueAt}\nManage: ${message.manageUrl}\nUnsubscribe: ${message.unsubscribeUrl}`,
      html: `<h1>${escapeHtml(message.title)}</h1><p>Due: ${escapeHtml(message.dueAt)}</p><p><a href="${escapeHtml(message.manageUrl)}">Manage reminder</a></p><p><a href="${escapeHtml(message.unsubscribeUrl)}">Unsubscribe</a></p>`,
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
