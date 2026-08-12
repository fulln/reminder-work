export type EmailIdentityStatus = "pending_verification" | "verified";

export interface EmailIdentity {
  readonly id: string;
  readonly ownerUserId: string;
  readonly recipientRef: string;
  readonly email: string;
  readonly status: EmailIdentityStatus;
  readonly deliverySuppressed: boolean;
  readonly activeReminderCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly verifiedAt: string | null;
}

export interface EmailIdentityRepository {
  remember(
    ownerUserId: string,
    email: string,
    createdAt: string,
    id?: string,
  ): Promise<EmailIdentity>;
  forget(ownerUserId: string, identityId: string): Promise<boolean>;
  createPending(
    ownerUserId: string,
    email: string,
    createdAt: string,
    id?: string,
  ): Promise<EmailIdentity>;
  findById(
    ownerUserId: string,
    identityId: string,
  ): Promise<EmailIdentity | null>;
  findByOwner(ownerUserId: string): Promise<EmailIdentity[]>;
  findByOwnerAndEmail(
    ownerUserId: string,
    email: string,
  ): Promise<EmailIdentity | null>;
  findByOwnerAndRecipientRef(
    ownerUserId: string,
    recipientRef: string,
  ): Promise<EmailIdentity | null>;
  markVerified(
    ownerUserId: string,
    identityId: string,
    verifiedAt: string,
  ): Promise<boolean>;
}
