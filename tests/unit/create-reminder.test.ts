import { describe, expect, it, vi } from "vitest";

import { createReminder } from "../../src/application/use-cases/create-reminder";
import type { CreateReminderDependencies } from "../../src/application/use-cases/create-reminder";

function dependencies(): CreateReminderDependencies {
  return {
    clock: { now: () => new Date("2026-08-10T10:00:00Z") },
    ids: { create: () => "reminder_01" },
    turnstile: { verify: vi.fn().mockResolvedValue(true) },
    contentProtector: {
      protect: vi.fn().mockResolvedValue({
        recipientRef: "recipient_hash",
        ciphertext: "ciphertext",
      }),
      unprotect: vi.fn(),
    },
    reminders: {
      create: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      save: vi.fn(),
    },
    suppressions: {
      isSuppressed: vi.fn().mockResolvedValue(false),
      suppress: vi.fn(),
    },
    emailCreationLimiter: {
      reserve: vi.fn().mockResolvedValue(true),
    },
    emailIdentities: {
      remember: vi.fn(),
      forget: vi.fn(),
      createPending: vi.fn(),
      findById: vi.fn(),
      findByOwner: vi.fn(),
      findByOwnerAndEmail: vi.fn(),
      findByOwnerAndRecipientRef: vi.fn(),
      markVerified: vi.fn(),
    },
    pushSubscriptions: {
      upsert: vi.fn().mockResolvedValue("push-subscription-1"),
      findActiveById: vi.fn(),
      revoke: vi.fn(),
    },
    scheduler: { schedule: vi.fn().mockResolvedValue(undefined) },
    tokens: {
      issue: vi.fn().mockResolvedValue("manage-token"),
      resolve: vi.fn(),
      consume: vi.fn(),
    },
  };
}

const emailReminder = {
  schemaVersion: 1 as const,
  title: "Prepare launch notes",
  recipientEmail: "owner@example.com",
  localDate: "2026-08-11",
  localTime: "09:00",
  timeZone: "Asia/Shanghai",
  turnstileToken: "test-pass",
};

const destinationId = "11111111-1111-4111-8111-111111111111";

describe("createReminder", () => {
  it("activates and schedules an email reminder without verification", async () => {
    const deps = dependencies();
    const result = await createReminder(deps, emailReminder, "request-01", {
      actorRef: "anonymous-actor",
    });

    expect(result).toMatchObject({
      ok: true,
      data: {
        state: "active",
        channels: ["email"],
        manageToken: "manage-token",
      },
    });
    expect(deps.reminders.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active" }),
      "request-01",
    );
    expect(deps.scheduler.schedule).toHaveBeenCalledOnce();
    expect(deps.tokens.issue).toHaveBeenCalledTimes(1);
    expect(deps.emailCreationLimiter.reserve).toHaveBeenCalledWith(
      expect.objectContaining({
        actorRef: "anonymous-actor",
        recipientRef: "recipient_hash",
        actorLimit: 3,
        recipientLimit: 10,
      }),
    );
  });

  it("activates and schedules a push-only reminder without email limits", async () => {
    const deps = dependencies();
    const result = await createReminder(
      deps,
      {
        ...emailReminder,
        recipientEmail: undefined,
        deliveryMode: "web_push",
        pushSubscription: {
          endpoint: "https://push.example.com/subscription/1",
          keys: {
            p256dh: "A".repeat(87),
            auth: "B".repeat(22),
          },
        },
      },
      "request-02",
    );

    expect(result).toMatchObject({
      ok: true,
      data: { state: "active", channels: ["web_push"] },
    });
    expect(deps.emailCreationLimiter.reserve).not.toHaveBeenCalled();
    expect(deps.suppressions.isSuppressed).not.toHaveBeenCalled();
  });

  it("fails closed when Turnstile rejects the request", async () => {
    const deps = dependencies();
    vi.mocked(deps.turnstile.verify).mockResolvedValue(false);

    const result = await createReminder(deps, emailReminder, "request-03");

    expect(result).toMatchObject({
      ok: false,
      error: { code: "TURNSTILE_REJECTED" },
    });
    expect(deps.reminders.create).not.toHaveBeenCalled();
  });

  it("remembers an authenticated creator's delivery address without claiming ownership", async () => {
    const deps = dependencies();
    const result = await createReminder(deps, emailReminder, "request-04", {
      ownerUserId: "user-1",
      actorRef: "user-actor",
    });

    expect(result.ok).toBe(true);
    expect(deps.emailIdentities?.remember).toHaveBeenCalledWith(
      "user-1",
      "owner@example.com",
      "2026-08-10T10:00:00.000Z",
    );
    expect(deps.emailCreationLimiter.reserve).toHaveBeenCalledWith(
      expect.objectContaining({ actorLimit: 25 }),
    );
  });

  it("fans out an authenticated reminder only to an owned destination", async () => {
    const deps: CreateReminderDependencies = {
      ...dependencies(),
      deliveryDestinations: {
        create: vi.fn(),
        replaceCredential: vi.fn(),
        findById: vi.fn().mockResolvedValue({
          id: destinationId,
          ownerUserId: "user-1",
          type: "webhook",
          label: "Automation",
          status: "active",
          credential: {
            kind: "webhook",
            url: "https://hooks.example.com/reminders",
            signingSecret: "sixteen-character-secret",
          },
          consecutiveFailures: 0,
          createdAt: "2026-08-10T10:00:00.000Z",
          updatedAt: "2026-08-10T10:00:00.000Z",
        }),
        findByOwner: vi.fn(),
        findSlackChannel: vi.fn(),
        setEnabled: vi.fn(),
        delete: vi.fn(),
        markSucceeded: vi.fn(),
        markFailed: vi.fn(),
      },
    };

    const result = await createReminder(
      deps,
      { ...emailReminder, destinationIds: [destinationId] },
      "request-destination",
      { ownerUserId: "user-1", actorRef: "user-actor" },
    );

    expect(result).toMatchObject({
      ok: true,
      data: { destinationCount: 1 },
    });
    expect(deps.reminders.create).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryPlan: {
          mode: "email",
          targets: [
            { channel: "email" },
            { channel: "destination", destinationId },
          ],
        },
      }),
      "request-destination",
    );
  });

  it("rejects another account's destination before persisting", async () => {
    const deps: CreateReminderDependencies = {
      ...dependencies(),
      deliveryDestinations: {
        create: vi.fn(),
        replaceCredential: vi.fn(),
        findById: vi.fn().mockResolvedValue({
          id: destinationId,
          ownerUserId: "user-2",
          type: "webhook",
          label: "Other account",
          status: "active",
          credential: {
            kind: "webhook",
            url: "https://hooks.example.com/reminders",
            signingSecret: "sixteen-character-secret",
          },
          consecutiveFailures: 0,
          createdAt: "2026-08-10T10:00:00.000Z",
          updatedAt: "2026-08-10T10:00:00.000Z",
        }),
        findByOwner: vi.fn(),
        findSlackChannel: vi.fn(),
        setEnabled: vi.fn(),
        delete: vi.fn(),
        markSucceeded: vi.fn(),
        markFailed: vi.fn(),
      },
    };

    const result = await createReminder(
      deps,
      { ...emailReminder, destinationIds: [destinationId] },
      "request-other-destination",
      { ownerUserId: "user-1", actorRef: "user-actor" },
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "DELIVERY_DESTINATION_UNAVAILABLE" },
    });
    expect(deps.reminders.create).not.toHaveBeenCalled();
  });

  it("does not let a creator override the recipient's global opt-out", async () => {
    const deps = dependencies();
    vi.mocked(deps.suppressions.isSuppressed).mockResolvedValue(true);

    const result = await createReminder(deps, emailReminder, "request-05", {
      ownerUserId: "user-1",
      actorRef: "user-actor",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "RECIPIENT_UNSUBSCRIBED", retryable: false },
    });
    expect(deps.emailCreationLimiter.reserve).not.toHaveBeenCalled();
    expect(deps.reminders.create).not.toHaveBeenCalled();
  });

  it("honors legacy recipient suppression after switching to keyed identifiers", async () => {
    const deps = dependencies();
    vi.mocked(deps.contentProtector.protect).mockResolvedValue({
      recipientRef: "keyed-recipient-ref",
      legacyRecipientRef: "legacy-recipient-ref",
      ciphertext: "ciphertext",
    });
    vi.mocked(deps.suppressions.isSuppressed).mockImplementation(
      (recipientRef) =>
        Promise.resolve(recipientRef === "legacy-recipient-ref"),
    );

    const result = await createReminder(deps, emailReminder, "request-05b", {
      actorRef: "anonymous-actor",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "RECIPIENT_UNSUBSCRIBED" },
    });
    expect(deps.suppressions.isSuppressed).toHaveBeenCalledWith(
      "keyed-recipient-ref",
    );
    expect(deps.suppressions.isSuppressed).toHaveBeenCalledWith(
      "legacy-recipient-ref",
    );
  });

  it("rate limits direct email creation before persisting a reminder", async () => {
    const deps = dependencies();
    vi.mocked(deps.emailCreationLimiter.reserve).mockResolvedValue(false);

    const result = await createReminder(deps, emailReminder, "request-06", {
      actorRef: "anonymous-actor",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "EMAIL_CREATION_RATE_LIMITED", retryable: true },
    });
    expect(deps.reminders.create).not.toHaveBeenCalled();
  });
});
