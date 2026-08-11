import { createContext } from "react-router";

import type { ActionResult } from "../application/contracts/action-result";
import type { ReminderDraftInput } from "../application/contracts/create-reminder";
import type { CreateReminderAccepted } from "../application/use-cases/create-reminder";
import type { ReviewReminderResult } from "../application/use-cases/review-reminder";
import type { ReminderView } from "../application/use-cases/get-reminder-view";
import type { ManageReminderInput } from "../application/use-cases/manage-reminder/manage-reminder";
import type { AuthServicePort } from "../application/ports/auth-service";

export interface ApplicationServices {
  readonly requestId: string;
  readonly showLocalVerificationPreview: boolean;
  readonly turnstileSiteKey: string;
  readonly auth: AuthServicePort;
  readonly authCallbackUrl: string;
  readonly secureAuthCookie: boolean;
  reviewReminder(input: ReminderDraftInput): ReviewReminderResult;
  createReminder(
    input: ReminderDraftInput,
  ): Promise<ActionResult<CreateReminderAccepted>>;
  verifyReminder(token: string): Promise<
    ActionResult<{
      readonly state: "active";
      readonly manageToken: string;
      readonly unsubscribeToken: string;
    }>
  >;
  getReminderView(token: string): Promise<ActionResult<ReminderView>>;
  manageReminder(
    input: ManageReminderInput,
  ): Promise<
    ActionResult<{ readonly state: string; readonly version: number }>
  >;
  unsubscribe(
    token: string,
  ): Promise<ActionResult<{ readonly state: "unsubscribed" }>>;
}

export const applicationServicesContext = createContext<ApplicationServices>();
