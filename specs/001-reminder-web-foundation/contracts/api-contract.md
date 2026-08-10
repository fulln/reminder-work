# API and Action Contract

All public mutations use same-origin HTTPS form actions and return HTML or a typed JSON
enhancement response according to content negotiation. Responses use a request ID but do
not echo email addresses, tokens, or reminder content into logs. Error codes are stable;
localized messages remain presentation concerns.

## Common envelope

```ts
type ActionResult<T> =
  | { ok: true; requestId: string; data: T }
  | {
      ok: false;
      requestId: string;
      error: {
        code: string;
        form?: string;
        fields?: Record<string, string[]>;
        retryable: boolean;
      };
    };
```

Validation failures use HTTP 400, invalid/expired opaque token states use a non-revealing
HTTP 404 presentation, optimistic version conflict uses 409, throttling uses 429, and
temporary platform failure uses 503. A successful mutation that cannot yet confirm an
asynchronous delivery reports accepted state rather than claiming delivery.

## `POST /reminders`

Creates a pending-verification reminder request after server-side Turnstile validation.

**Input**: `schemaVersion`, title, recipient email, local date/time, IANA time zone,
optional DST-fold selection, preset ID, recurrence, lead offsets, and acknowledgement
policy.

**Success 202**:

```ts
type CreateReminderAccepted = {
  state: "pending_verification";
  maskedRecipient: string;
  expiresAt: string;
};
```

The response never exposes a reminder ID suitable for management. Duplicate safe retry
uses a server-issued idempotency value associated with the form session.

## `POST /verify/:token`

Consumes a single-purpose verification token and activates the reminder if it remains
eligible. Repeat consumption returns the same safe public outcome, not a second effect.

**Success**: `active`, `already_verified`, or a generic unavailable state.

## `GET /manage/:token`

Returns/render a minimal `ReminderView`. Invalid, malformed, expired, or unknown tokens
share the same non-revealing response. Valid states expose only the title, due labels,
state, version, and permitted actions.

## Management mutations

- `POST /manage/:token/done`
- `POST /manage/:token/snooze`
- `POST /manage/:token/reschedule`
- `POST /manage/:token/cancel`

All inputs include `schemaVersion`, CSRF proof where applicable, and the displayed
reminder `version`. Snooze/reschedule also include local date/time and IANA zone. On 409,
the response contains the newest safe `ReminderView` and asks the user to review it.
Successful results return the new state/version and resolved local plus UTC time where
applicable.

## `POST /unsubscribe/:token`

Records recipient suppression and invalidates later sends before content decryption.
Repeat calls are idempotently successful. The response does not reveal other reminders
or account information.

## Internal versioned messages

Queue and Workflow payloads contain only:

```ts
type ReminderWorkMessageV1 = {
  schemaVersion: 1;
  reminderId: string;
  expectedVersion: number;
  operation: "schedule" | "deliver" | "reconcile";
  idempotencyKey: string;
};
```

The consumer reloads D1 state and verifies status, version, consent, suppression, and
delivery eligibility before side effects. Adding/removing/renaming a payload field
requires a new schema version and compatibility test.
