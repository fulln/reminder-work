import type { ReminderWorkflowMessage } from "./workflows/reminder-workflow-message";

export interface CloudflareEnv {
  ASSETS: Fetcher;
  AUTH_SERVICE: Fetcher;
  DB: D1Database;
  REMINDER_QUEUE: Queue;
  REMINDER_WORKFLOW: Workflow<ReminderWorkflowMessage>;
  EMAIL: SendEmail;
  APP_ORIGIN: string;
  AUTH_BASE_URL: string;
  AUTH_RELYING_WEBSITE_ID: string;
  TURNSTILE_SITE_KEY: string;
  TURNSTILE_SECRET_KEY?: string;
  CONTENT_ENCRYPTION_KEY: string;
  EMAIL_FROM: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT: string;
  SLACK_CLIENT_ID?: string;
  SLACK_CLIENT_SECRET?: string;
}
