import { describe, expect, it, vi } from "vitest";

import { normalizeOutboundWebhookUrl } from "../../src/application/support/outbound-webhook-url";
import {
  createWebhookDestination,
  finishSlackConnection,
  testDeliveryDestination,
} from "../../src/application/use-cases/delivery-destinations";
import type {
  DeliveryDestination,
  DeliveryDestinationRepository,
  NewDeliveryDestination,
} from "../../src/application/ports/delivery-destination-repository";

function destinationRepository(): DeliveryDestinationRepository & {
  items: DeliveryDestination[];
} {
  const items: DeliveryDestination[] = [];
  return {
    items,
    create: vi.fn((input: NewDeliveryDestination) => {
      const destination: DeliveryDestination = {
        ...input,
        type: input.credential.kind,
        status: "active",
        consecutiveFailures: 0,
        updatedAt: input.createdAt,
      };
      items.push(destination);
      return Promise.resolve(destination);
    }),
    replaceCredential: vi.fn(
      (
        input: Parameters<
          DeliveryDestinationRepository["replaceCredential"]
        >[0],
      ) => {
        const index = items.findIndex(
          (item) =>
            item.id === input.id && item.ownerUserId === input.ownerUserId,
        );
        if (index === -1) return Promise.resolve(null);
        const current = items[index];
        if (current === undefined) return Promise.resolve(null);
        const destination: DeliveryDestination = {
          ...current,
          type: input.credential.kind,
          label: input.label,
          status: "active",
          credential: input.credential,
          consecutiveFailures: 0,
          updatedAt: input.updatedAt,
        };
        items[index] = destination;
        return Promise.resolve(destination);
      },
    ),
    findById: vi.fn((id) =>
      Promise.resolve(items.find((item) => item.id === id) ?? null),
    ),
    findByOwner: vi.fn((ownerUserId) =>
      Promise.resolve(items.filter((item) => item.ownerUserId === ownerUserId)),
    ),
    findSlackChannel: vi.fn((ownerUserId, workspaceId, channelId) =>
      Promise.resolve(
        items.find(
          (item) =>
            item.ownerUserId === ownerUserId &&
            item.credential.kind === "slack" &&
            item.credential.workspaceId === workspaceId &&
            item.credential.channelId === channelId,
        ) ?? null,
      ),
    ),
    setEnabled: vi.fn().mockResolvedValue(true),
    delete: vi.fn().mockResolvedValue(true),
    markSucceeded: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
  };
}

describe("outbound webhook URL policy", () => {
  it.each([
    "http://example.com/hook",
    "https://localhost/hook",
    "https://127.0.0.1/hook",
    "https://[::1]/hook",
    "https://user:secret@example.com/hook",
    "https://example.com:8443/hook",
    "https://service.local/hook",
    "https://reminders.work/auth/logout",
  ])("rejects unsafe destination %s", (url) => {
    expect(normalizeOutboundWebhookUrl(url)).toBeNull();
  });

  it("normalizes a public HTTPS URL", () => {
    expect(
      normalizeOutboundWebhookUrl(" https://hooks.example.com/reminder "),
    ).toBe("https://hooks.example.com/reminder");
  });
});

describe("delivery destination use cases", () => {
  it("creates an encrypted-repository webhook model only for valid input", async () => {
    const destinations = destinationRepository();
    const result = await createWebhookDestination(
      {
        clock: { now: () => new Date("2026-08-12T00:00:00Z") },
        ids: { create: () => "destination-1" },
        destinations,
      },
      "user-1",
      {
        label: "Team automation",
        url: "https://hooks.example.com/reminders",
        signingSecret: "sixteen-character-secret",
      },
      "request-1",
    );
    expect(result).toMatchObject({
      ok: true,
      data: {
        destination: {
          id: "destination-1",
          type: "webhook",
          detail: "hooks.example.com",
        },
      },
    });
  });

  it("records destination health when a test delivery succeeds", async () => {
    const destinations = destinationRepository();
    await destinations.create({
      id: "destination-1",
      ownerUserId: "user-1",
      label: "Team automation",
      credential: {
        kind: "webhook",
        url: "https://hooks.example.com/reminders",
        signingSecret: "sixteen-character-secret",
      },
      createdAt: "2026-08-12T00:00:00Z",
    });
    const webhookDelivery = { send: vi.fn().mockResolvedValue(undefined) };
    const attempts = {
      countRecentTests: vi.fn().mockResolvedValue(0),
      record: vi.fn().mockResolvedValue(undefined),
    };
    const result = await testDeliveryDestination(
      {
        clock: { now: () => new Date("2026-08-12T01:00:00Z") },
        ids: { create: () => "test-1" },
        destinations,
        attempts,
        slackDelivery: { send: vi.fn() },
        webhookDelivery,
        origin: "https://reminders.work",
      },
      "user-1",
      "destination-1",
      "request-1",
    );
    expect(result.ok).toBe(true);
    expect(webhookDelivery.send).toHaveBeenCalledOnce();
    expect(destinations.markSucceeded).toHaveBeenCalledWith(
      "destination-1",
      "2026-08-12T01:00:00.000Z",
    );
    expect(attempts.record).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "sent" }),
    );
  });

  it("rate limits repeated test deliveries before making an outbound call", async () => {
    const destinations = destinationRepository();
    await destinations.create({
      id: "destination-1",
      ownerUserId: "user-1",
      label: "Team automation",
      credential: {
        kind: "webhook",
        url: "https://hooks.example.com/reminders",
        signingSecret: "sixteen-character-secret",
      },
      createdAt: "2026-08-12T00:00:00Z",
    });
    const webhookDelivery = { send: vi.fn() };
    const result = await testDeliveryDestination(
      {
        clock: { now: () => new Date("2026-08-12T01:00:00Z") },
        ids: { create: () => "test-1" },
        destinations,
        attempts: {
          countRecentTests: vi.fn().mockResolvedValue(5),
          record: vi.fn(),
        },
        slackDelivery: { send: vi.fn() },
        webhookDelivery,
        origin: "https://reminders.work",
      },
      "user-1",
      "destination-1",
      "request-1",
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: "DESTINATION_TEST_RATE_LIMITED", retryable: true },
    });
    expect(webhookDelivery.send).not.toHaveBeenCalled();
  });

  it("consumes user-bound state before saving the selected Slack channel", async () => {
    const destinations = destinationRepository();
    const result = await finishSlackConnection(
      {
        clock: { now: () => new Date("2026-08-12T00:00:00Z") },
        ids: { create: () => "slack-1" },
        states: { issue: vi.fn(), consume: vi.fn().mockResolvedValue(true) },
        slackOAuth: {
          available: true,
          authorizationUrl: vi.fn(),
          exchangeCode: vi.fn().mockResolvedValue({
            kind: "slack",
            webhookUrl: "https://hooks.slack.com/services/T/B/S",
            workspaceId: "T1",
            workspaceName: "Acme",
            channelId: "C1",
            channelName: "#ops",
          }),
          revoke: vi.fn(),
        },
        destinations,
        redirectUri: "https://reminders.work/integrations/slack/callback",
      },
      "user-1",
      { state: "state", code: "code" },
      "request-1",
    );
    expect(result).toMatchObject({
      ok: true,
      data: { destination: { label: "Slack · #ops", detail: "Acme · #ops" } },
    });
  });

  it("rotates a reconnected Slack channel in place", async () => {
    const destinations = destinationRepository();
    await destinations.create({
      id: "stable-slack-id",
      ownerUserId: "user-1",
      label: "Slack · #ops",
      credential: {
        kind: "slack",
        webhookUrl: "https://hooks.slack.com/services/T/B/OLD",
        workspaceId: "T1",
        workspaceName: "Acme",
        channelId: "C1",
        channelName: "#ops",
      },
      createdAt: "2026-08-11T00:00:00Z",
    });
    const result = await finishSlackConnection(
      {
        clock: { now: () => new Date("2026-08-12T00:00:00Z") },
        ids: { create: () => "replacement-id" },
        states: { issue: vi.fn(), consume: vi.fn().mockResolvedValue(true) },
        slackOAuth: {
          available: true,
          authorizationUrl: vi.fn(),
          exchangeCode: vi.fn().mockResolvedValue({
            kind: "slack",
            webhookUrl: "https://hooks.slack.com/services/T/B/NEW",
            workspaceId: "T1",
            workspaceName: "Acme",
            channelId: "C1",
            channelName: "#ops",
          }),
          revoke: vi.fn(),
        },
        destinations,
        redirectUri: "https://reminders.work/integrations/slack/callback",
      },
      "user-1",
      { state: "state", code: "code" },
      "request-1",
    );
    expect(result).toMatchObject({
      ok: true,
      data: { destination: { id: "stable-slack-id" } },
    });
    expect(destinations.replaceCredential).toHaveBeenCalledWith(
      expect.objectContaining({ id: "stable-slack-id" }),
    );
    expect(destinations.items).toHaveLength(1);
  });
});
