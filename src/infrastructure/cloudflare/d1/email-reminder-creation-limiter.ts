import type {
  EmailReminderCreationAttempt,
  EmailReminderCreationLimiter,
} from "../../../application/ports/email-reminder-creation-limiter";

export class D1EmailReminderCreationLimiter implements EmailReminderCreationLimiter {
  constructor(private readonly database: D1Database) {}

  async reserve(attempt: EmailReminderCreationAttempt): Promise<boolean> {
    await this.database
      .prepare(
        "DELETE FROM email_reminder_creation_events WHERE created_at < ?",
      )
      .bind(attempt.discardBefore)
      .run();

    const result = await this.database
      .prepare(
        `INSERT INTO email_reminder_creation_events
         (id, actor_ref, recipient_ref, created_at)
         SELECT ?, ?, ?, ?
         WHERE (
           SELECT COUNT(*) FROM email_reminder_creation_events
           WHERE actor_ref = ? AND created_at >= ?
         ) < ?
         AND (
           SELECT COUNT(*) FROM email_reminder_creation_events
           WHERE recipient_ref = ? AND created_at >= ?
         ) < ?`,
      )
      .bind(
        attempt.id,
        attempt.actorRef,
        attempt.recipientRef,
        attempt.createdAt,
        attempt.actorRef,
        attempt.discardBefore,
        attempt.actorLimit,
        attempt.recipientRef,
        attempt.discardBefore,
        attempt.recipientLimit,
      )
      .run();
    return result.meta.changes === 1;
  }
}
