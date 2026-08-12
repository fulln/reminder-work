# Delivery destinations: Slack and signed webhooks

Status: Accepted for implementation
Date: 2026-08-12

## Summary

Keep the existing email and browser-notification behavior compatible, and add
account-owned external delivery destinations. A reminder continues to carry its
current primary delivery mode, plus zero or more destination references. The
delivery worker fans out to active destinations through typed adapters while the
existing delivery claim remains the idempotency boundary.

The first external destination types are Slack Incoming Webhooks installed via
Slack OAuth v2 and generic HTTPS webhooks signed with HMAC-SHA256. Other providers
are explicitly out of scope.

## Context and drivers

The current `DeliveryMode` encodes email, web push, and one fallback combination.
Adding provider names to that enum would create a product of channel and policy
combinations. External credentials also have a different owner and lifecycle from
reminders: a Slack channel or webhook can be reused by many reminders, rotated,
disabled, or disconnected independently.

Drivers:

- Existing anonymous email and browser reminder behavior must remain unchanged.
- External destinations are available only to authenticated owners.
- Provider secrets and webhook URLs must be encrypted at rest and never logged.
- Queue retries must not resend a channel that already succeeded.
- One failing destination must not erase or mutate a reminder.
- The settings page must expose destination health without exposing credentials.
- Slack OAuth state must be one-time, user-bound, and short-lived.
- Generic webhooks must resist SSRF and provide verifiable request authenticity.

Non-goals:

- Slack as an authentication provider.
- Telegram, Teams, SMS, WhatsApp, Discord, or arbitrary plugin execution.
- A general workflow automation engine.
- User-defined payload templates in the first release.

Unknown scale targets remain bounded by the existing reminder queue. The initial
operational target is one external request per destination per reminder occurrence,
with the same queue retry and backpressure behavior as email and web push.

## Domain model and invariants

### DeliveryDestination

An account-owned, reusable delivery endpoint.

```ts
type DeliveryDestinationType = "slack" | "webhook";
type DeliveryDestinationStatus = "active" | "failing" | "disabled";

interface DeliveryDestination {
  id: string;
  ownerUserId: string;
  type: DeliveryDestinationType;
  label: string;
  status: DeliveryDestinationStatus;
  credentialCiphertext: string;
  consecutiveFailures: number;
  lastSuccessAt?: string;
  lastFailureAt?: string;
}
```

Invariants:

- Only the owner can list, select, test, disable, or delete a destination.
- A reminder can reference only active or failing destinations owned by its owner.
- Anonymous reminders cannot reference external destinations.
- Credentials are decrypted only in trusted infrastructure and are never exposed
  through presentation contracts or logs.
- A disabled or deleted destination is skipped safely by already-scheduled reminders.
- Three consecutive terminal provider failures move a destination to `failing`;
  a successful test or delivery returns it to `active`. `disabled` is explicit.

### Delivery plan

The existing mode remains the compatibility policy for email/web push. External
destinations are fan-out targets and do not silently replace the selected primary
delivery channel.

```ts
interface DeliveryPlan {
  mode: "email" | "web_push" | "web_push_email_fallback";
  targets: (
    | { channel: "email" }
    | { channel: "web_push"; subscriptionId: string }
    | { channel: "destination"; destinationId: string }
  )[];
}
```

This deliberately avoids a speculative policy engine. A future requirement for
acknowledgement-based escalation is the review trigger for adding a separate
`DeliveryPolicy` aggregate.

### DeliveryAttempt

An append/update record keyed by the same occurrence-specific idempotency key used
by delivery claims. It supplies destination health and diagnostics without storing
message contents.

## Alternatives

| Option                                              | Benefits                                      | Costs                                                   | Decision                   |
| --------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------- | -------------------------- |
| Add Slack/Webhook values to `DeliveryMode`          | Small initial diff                            | Combination explosion; credentials coupled to reminders | Rejected                   |
| Store provider URL/token directly on every reminder | Immutable snapshot                            | Duplicates secrets; rotation and disconnect are unsafe  | Rejected                   |
| Account-owned destinations referenced by reminders  | Reuse, rotation, ownership, health visibility | Requires repository and settings lifecycle              | Accepted                   |
| Split delivery into a new service                   | Independent scaling                           | Extra deployment, consistency and operational burden    | Rejected for current scale |

## Components and contracts

- `DeliveryDestinationRepository`: encrypted destination persistence, ownership,
  status transitions, and health updates.
- `DeliveryAttemptRepository`: idempotent, content-free operational status.
- `ExternalDeliveryPort`: sends a normalized reminder event to one destination.
- `SlackOAuthPort`: builds authorization URLs, exchanges codes, and returns a
  selected workspace/channel credential.
- `SlackOAuthStateRepository`: one-time state issuance and consumption.
- `SlackDeliveryAdapter`: posts a fixed Block Kit payload to the installed Incoming
  Webhook URL.
- `SignedWebhookDeliveryAdapter`: POSTs a versioned JSON envelope with timestamp,
  event, idempotency, and HMAC signature headers.

Application use cases own authorization and lifecycle. Infrastructure adapters do
not decide which user may operate on a destination.

## Flows

### Create signed webhook destination

1. Authenticated user submits label, HTTPS URL, and signing secret.
2. Application validates length and destination ownership context.
3. URL policy rejects credentials, non-HTTPS protocols, non-default ports,
   localhost, IP literals, and private/reserved hostnames.
4. Repository encrypts URL and secret and persists an active destination.
5. Test delivery uses the same adapter and health transition as real delivery.

### Install Slack destination

1. Authenticated user requests `/integrations/slack/start`.
2. Server issues a random, one-time state bound to the user for ten minutes.
3. Browser is redirected to Slack OAuth v2 with only `incoming-webhook` scope.
4. Callback validates the active session and consumes matching state before code
   exchange.
5. Slack returns the selected workspace, channel, and Incoming Webhook URL.
6. Repository encrypts the credential and stores a reusable destination.
7. Reconnecting the same workspace/channel rotates credentials in place so
   reminders keep their stable destination reference.

### Reminder delivery

1. Existing workflow enqueues one occurrence message.
2. Worker loads current reminder state and decrypts reminder content once.
3. Existing primary email/web-push policy runs unchanged.
4. Each external target loads an owned, deliverable destination.
5. The worker claims `<occurrence>:destination:<id>` before sending.
6. Adapter sends a normalized event with secure manage URL.
7. Claim, attempt, and destination health are updated. A retry skips claims already
   sent and retries only failed/unclaimed channels.

Failure behavior:

- Invalid/deleted/disabled destination: skip and record a non-retryable attempt.
- 400/401/403/404/410 from a provider: mark a terminal failure without retry;
  destination becomes `failing` after the health threshold.
- 429/5xx/network timeout: retry through the queue and preserve successful claims.
- Email suppression remains email-specific and does not suppress Slack/Webhook.
- Slack or webhook failure never prevents the primary delivery from being claimed
  independently; the queue retries only the failed destination.

## Security and operations

- AES-GCM encrypted JSON uses `CONTENT_ENCRYPTION_KEY`; ciphertext is versioned by
  the existing encryption envelope.
- Webhook request signature:
  `v1=hex(HMAC-SHA256(secret, timestamp + "." + exactBody))`.
- Webhook headers include schema/event, timestamp, idempotency key, and signature.
- Receivers should reject timestamps outside a five-minute replay window and
  deduplicate the idempotency key.
- Outbound requests use a short timeout, `redirect: "error"`, fixed content type,
  and no user-controlled headers.
- The Worker uses Cloudflare's `global_fetch_strictly_public` routing mode, and
  URL validation rejects local/IP/internal application targets before every send.
- Runtime logs contain destination ID/type and error class only, never URLs,
  credentials, reminder titles, or payload bodies.
- D1 stores last success/failure, consecutive failure count, and content-free
  attempts. These support the settings health UI and incident diagnosis.
- Accounts can save up to 20 external destinations, and each destination accepts
  at most five test sends per rolling hour.
- Slack client secret is a Worker secret. Client ID may be a variable. The feature
  reports unavailable when either is absent.

## Migration, rollout, and rollback

1. Add destination, OAuth state, and attempt tables without modifying existing rows.
2. Extend delivery-plan parsing to accept destination targets while retaining old
   JSON unchanged.
3. Release destination management and test delivery.
4. Release composer selection for authenticated users.
5. Configure Slack credentials and redirect URL, then enable Slack connect UI.

Rollback disables the integration UI and external adapter wiring. Existing reminder
rows remain readable because destination targets are additive; missing destination
records are skipped. The additive tables can remain without affecting old behavior.

## Verification

- Unit: URL policy, HMAC fixture, OAuth URL/state, delivery-plan compatibility.
- Integration: encrypted repository round trip, owner isolation, health transitions,
  Slack/webhook HTTP success and failures, retry idempotency.
- Browser: authenticated settings lifecycle and selected destinations surviving
  review/create forms.
- Regression: full existing email/web-push, management, calendar, auth, architecture,
  performance, and migration gates.

## Consequences and review triggers

The accepted design adds one real axis of variation—account-owned external
destinations—without introducing a general provider registry or policy language.
Revisit the model when the product needs delayed fallback, acknowledgement-based
escalation, per-destination quiet hours, or more than two external providers.
