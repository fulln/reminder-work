import { createContext } from "react-router";

import type { ActionResult } from "../application/contracts/action-result";
import type {
  ReminderDetailsInput,
  ReminderDraftInput,
} from "../application/contracts/create-reminder";
import type { CreateReminderAccepted } from "../application/use-cases/create-reminder";
import type { ReviewReminderResult } from "../application/use-cases/review-reminder";
import type { ReminderView } from "../application/use-cases/get-reminder-view";
import type { ManageReminderInput } from "../application/use-cases/manage-reminder/manage-reminder";
import type { AuthServicePort } from "../application/ports/auth-service";
import type { ReminderStatus } from "../domain/reminder/reminder";
import type { ReminderSchedule } from "../domain/reminder/schedule";
import type { DeliveryDestinationView } from "../application/use-cases/delivery-destinations";

export interface OwnedReminderSummary {
  readonly id: string;
  readonly title: string;
  readonly status: ReminderStatus;
  readonly schedule: ReminderSchedule;
  readonly deliveryLabel: string;
  readonly maskedRecipient: string;
}

export interface EmailIdentityView {
  readonly id: string;
  readonly email: string;
  readonly status: "active" | "blocked";
  readonly activeReminderCount: number;
  readonly lastUsedAtLabel: string;
}

export type OwnedReminderActionInput =
  | {
      readonly reminderId: string;
      readonly expectedVersion: number;
      readonly action: "complete" | "cancel";
    }
  | {
      readonly reminderId: string;
      readonly expectedVersion: number;
      readonly action: "snooze";
      readonly minutes: number;
    }
  | {
      readonly reminderId: string;
      readonly expectedVersion: number;
      readonly action: "reschedule";
      readonly anchorLocal: string;
      readonly resolvedUtc: string;
    };

type EmailSettingsActionResult = ActionResult<{ readonly message: string }>;

export interface ApplicationServices {
  readonly requestId: string;
  readonly showLocalVerificationPreview: boolean;
  readonly turnstileSiteKey: string;
  readonly vapidPublicKey: string;
  readonly auth: AuthServicePort;
  readonly authCallbackUrl: string;
  readonly authLoginUrl: string;
  readonly secureAuthCookie: boolean;
  readonly slackAvailable: boolean;
  reviewReminder(input: ReminderDetailsInput): ReviewReminderResult;
  createReminder(
    input: ReminderDraftInput,
    ownerUserId?: string,
  ): Promise<ActionResult<CreateReminderAccepted>>;
  verifyReminder(token: string): Promise<
    ActionResult<{
      readonly state: "active";
      readonly manageToken: string;
      readonly unsubscribeToken: string;
      readonly calendarSubscriptionUrl?: string;
      readonly calendarFeedUrl?: string;
    }>
  >;
  getCalendarFeed(token: string): Promise<string | null>;
  getReminderView(token: string): Promise<ActionResult<ReminderView>>;
  manageReminder(
    input: ManageReminderInput,
  ): Promise<
    ActionResult<{ readonly state: string; readonly version: number }>
  >;
  unsubscribe(
    token: string,
  ): Promise<ActionResult<{ readonly state: "unsubscribed" }>>;
  listOwnedReminders(
    userId: string,
  ): Promise<ActionResult<{ readonly items: readonly OwnedReminderSummary[] }>>;
  getOwnedReminderView(
    userId: string,
    reminderId: string,
  ): Promise<ActionResult<ReminderView>>;
  manageOwnedReminder(
    userId: string,
    input: OwnedReminderActionInput,
  ): Promise<
    ActionResult<{ readonly state: string; readonly version: number }>
  >;
  getEmailSettings(userId: string): Promise<
    ActionResult<{
      readonly identities: readonly EmailIdentityView[];
    }>
  >;
  forgetSavedEmailRecipient(
    userId: string,
    recipientId: string,
  ): Promise<EmailSettingsActionResult>;
  verifyEmailIdentity(token: string): Promise<EmailSettingsActionResult>;
  listDeliveryDestinations(userId: string): Promise<
    ActionResult<{
      readonly destinations: readonly DeliveryDestinationView[];
    }>
  >;
  createWebhookDestination(
    userId: string,
    input: {
      readonly label: string;
      readonly url: string;
      readonly signingSecret: string;
    },
  ): Promise<ActionResult<{ readonly message: string }>>;
  testDeliveryDestination(
    userId: string,
    destinationId: string,
  ): Promise<ActionResult<{ readonly message: string }>>;
  setDeliveryDestinationEnabled(
    userId: string,
    destinationId: string,
    enabled: boolean,
  ): Promise<ActionResult<{ readonly message: string }>>;
  deleteDeliveryDestination(
    userId: string,
    destinationId: string,
  ): Promise<ActionResult<{ readonly message: string }>>;
  beginSlackConnection(
    userId: string,
  ): Promise<ActionResult<{ readonly authorizationUrl: string }>>;
  finishSlackConnection(
    userId: string,
    input: { readonly state: string; readonly code: string },
  ): Promise<ActionResult<{ readonly message: string }>>;
}

export const applicationServicesContext = createContext<ApplicationServices>();
