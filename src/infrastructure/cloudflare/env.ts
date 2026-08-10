import type { ReminderWorkflowMessage } from "./workflows/reminder-workflow-message";

export interface CloudflareEnv {
  ASSETS: Fetcher;
  DB: D1Database;
  REMINDER_QUEUE: Queue;
  REMINDER_WORKFLOW: Workflow<ReminderWorkflowMessage>;
  EMAIL: SendEmail;
  APP_ORIGIN: string;
  TURNSTILE_SITE_KEY: string;
  TURNSTILE_SECRET_KEY?: string;
  CONTENT_ENCRYPTION_KEY: string;
  EMAIL_FROM: string;
}
