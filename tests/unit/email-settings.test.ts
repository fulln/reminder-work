import { describe, expect, it, vi } from "vitest";

import {
  forgetSavedEmailRecipient,
  getEmailSettings,
  verifyEmailIdentity,
} from "../../src/application/use-cases/email-settings";
import type { EmailIdentity } from "../../src/application/ports/email-identity-repository";

const savedRecipient: EmailIdentity = {
  id: "identity-1",
  ownerUserId: "user-1",
  recipientRef: "recipient-ref",
  email: "owner@example.com",
  status: "verified",
  deliverySuppressed: false,
  activeReminderCount: 3,
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-11T00:00:00.000Z",
  verifiedAt: "2026-08-10T00:00:00.000Z",
};

function emailDependencies() {
  return {
    clock: { now: () => new Date("2026-08-11T00:00:00.000Z") },
    emailIdentities: {
      remember: vi.fn(),
      forget: vi.fn().mockResolvedValue(true),
      createPending: vi.fn(),
      findById: vi.fn(),
      findByOwner: vi
        .fn()
        .mockResolvedValue([
          savedRecipient,
          { ...savedRecipient, id: "identity-2", deliverySuppressed: true },
        ]),
      findByOwnerAndEmail: vi.fn(),
      findByOwnerAndRecipientRef: vi.fn(),
      markVerified: vi.fn().mockResolvedValue(true),
    },
    verificationTokens: {
      issue: vi.fn(),
      resolve: vi.fn(),
      consume: vi.fn(),
    },
  };
}

describe("email settings", () => {
  it("lists saved delivery addresses without claiming mailbox ownership", async () => {
    const result = await getEmailSettings(
      emailDependencies(),
      "user-1",
      "request-1",
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        identities: [
          {
            id: "identity-1",
            fullEmail: "owner@example.com",
            maskedEmail: "o***r@example.com",
            state: "active",
            activeReminderCount: 3,
            lastUsedAt: "2026-08-11T00:00:00.000Z",
          },
          { id: "identity-2", state: "blocked" },
        ],
      },
    });
  });

  it("forgets only the creator's saved address", async () => {
    const deps = emailDependencies();
    const result = await forgetSavedEmailRecipient(
      deps,
      "user-1",
      "identity-1",
      "request-2",
    );

    expect(result).toMatchObject({ ok: true, data: { forgotten: true } });
    expect(deps.emailIdentities.forget).toHaveBeenCalledWith(
      "user-1",
      "identity-1",
    );
  });

  it("keeps pre-existing verification links compatible", async () => {
    const deps = emailDependencies();
    vi.mocked(deps.verificationTokens.resolve).mockResolvedValue({
      identityId: "identity-1",
      ownerUserId: "user-1",
      expiresAt: "2026-08-11T00:30:00.000Z",
    });
    vi.mocked(deps.emailIdentities.findById).mockResolvedValue({
      ...savedRecipient,
      status: "pending_verification",
      verifiedAt: null,
    });

    const result = await verifyEmailIdentity(deps, "legacy-token", "request-3");

    expect(result).toMatchObject({
      ok: true,
      data: { identityId: "identity-1", state: "verified" },
    });
    expect(deps.emailIdentities.markVerified).toHaveBeenCalledOnce();
    expect(deps.verificationTokens.consume).toHaveBeenCalledWith(
      "legacy-token",
    );
  });
});
