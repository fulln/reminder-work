import { failure, success } from "../contracts/action-result";
import type { ActionResult } from "../contracts/action-result";
import type { Clock } from "../ports/clock";
import type { EmailIdentityRepository } from "../ports/email-identity-repository";
import type { EmailIdentityVerificationTokenRepository } from "../ports/email-identity-verification-token-repository";
import { maskEmail } from "../support/email-address";

export interface SavedEmailRecipientView {
  readonly id: string;
  readonly fullEmail: string;
  readonly maskedEmail: string;
  readonly state: "active" | "blocked";
  readonly activeReminderCount: number;
  readonly lastUsedAt: string;
}

export interface EmailSettingsDependencies {
  readonly emailIdentities: EmailIdentityRepository;
}

export async function getEmailSettings(
  dependencies: EmailSettingsDependencies,
  userId: string,
  requestId: string,
): Promise<ActionResult<{ readonly identities: SavedEmailRecipientView[] }>> {
  const identities = await dependencies.emailIdentities.findByOwner(userId);
  return success(requestId, {
    identities: identities.map((identity) => ({
      id: identity.id,
      fullEmail: identity.email,
      maskedEmail: maskEmail(identity.email),
      state: identity.deliverySuppressed ? "blocked" : "active",
      activeReminderCount: identity.activeReminderCount,
      lastUsedAt: identity.updatedAt,
    })),
  });
}

export async function forgetSavedEmailRecipient(
  dependencies: EmailSettingsDependencies,
  userId: string,
  identityId: string,
  requestId: string,
): Promise<ActionResult<{ readonly forgotten: true }>> {
  const forgotten = await dependencies.emailIdentities.forget(
    userId,
    identityId,
  );
  if (!forgotten) {
    return failure(requestId, {
      code: "EMAIL_RECIPIENT_UNAVAILABLE",
      retryable: false,
      form: "This saved delivery address is unavailable.",
    });
  }
  return success(requestId, { forgotten: true });
}

/**
 * Legacy compatibility for links issued before direct delivery was enabled.
 * New reminder creation does not issue email verification tokens.
 */
export async function verifyEmailIdentity(
  dependencies: EmailSettingsDependencies & {
    readonly clock: Clock;
    readonly verificationTokens: EmailIdentityVerificationTokenRepository;
  },
  token: string,
  requestId: string,
): Promise<
  ActionResult<{
    readonly identityId: string;
    readonly state: "verified";
  }>
> {
  const claims = await dependencies.verificationTokens.resolve(token);
  if (
    claims === null ||
    new Date(claims.expiresAt) <= dependencies.clock.now()
  ) {
    return verificationUnavailable(requestId);
  }

  const identity = await dependencies.emailIdentities.findById(
    claims.ownerUserId,
    claims.identityId,
  );
  if (identity === null) return verificationUnavailable(requestId);
  try {
    if (identity.status !== "verified") {
      await dependencies.emailIdentities.markVerified(
        claims.ownerUserId,
        identity.id,
        dependencies.clock.now().toISOString(),
      );
    }
  } catch {
    return failure(requestId, {
      code: "VERIFICATION_RETRYABLE",
      retryable: true,
      form: "We could not verify this email yet. Open the link again to retry.",
    });
  }
  try {
    await dependencies.verificationTokens.consume(token);
  } catch {
    // The legacy verified state is authoritative and makes replay harmless.
  }
  return success(requestId, {
    identityId: identity.id,
    state: "verified",
  });
}

function verificationUnavailable(requestId: string): ActionResult<never> {
  return failure(requestId, {
    code: "VERIFICATION_UNAVAILABLE",
    retryable: false,
    form: "This verification link is invalid or has expired.",
  });
}
