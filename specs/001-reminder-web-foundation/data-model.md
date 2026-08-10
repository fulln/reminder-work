# Data Model: Reminder Web Foundation

This document describes the feature-facing model. Persistence details remain compatible
with the authoritative system design in `docs/architecture.md`; all persisted JSON and
asynchronous payloads carry an explicit `schemaVersion`.

## ReminderDraft

User-entered state that is not yet authoritative.

| Field | Type | Rules |
|---|---|---|
| `title` | string | 1–160 visible characters after normalization |
| `recipientEmail` | string | normalized email; never written to client logs |
| `localDate` | ISO local date | valid calendar date |
| `localTime` | ISO local time | minute precision at launch |
| `timeZone` | IANA zone | required; abbreviations forbidden |
| `presetId` | CapabilityPresetId | optional source intent; never changes domain meaning |
| `schedule` | ReminderScheduleDraft | one-time or recurrence data |
| `delivery` | DeliveryOptions | email-only at launch |
| `acknowledgement` | AcknowledgementPolicy | explicit follow-up behavior |

Validation resolves the local date/time and IANA zone into a deterministic UTC instant.
DST gaps return a recoverable validation error. DST folds require an explicit earlier or
later offset choice.

## ReminderSchedule

| Field | Type | Rules |
|---|---|---|
| `kind` | `once \| recurring` | discriminant |
| `anchorLocal` | local date-time | original wall-clock intent |
| `timeZone` | IANA zone | retained for future recurrence |
| `resolvedUtc` | UTC instant | exact next occurrence |
| `recurrence` | RecurrenceRule or null | required only for `recurring` |
| `leadOffsets` | duration[] | ordered, deduplicated, cannot resolve after due time |

`RecurrenceRule` supports a bounded launch vocabulary: daily, selected weekdays,
weekly, monthly-by-date, and interval count. Month-end overflow policy is explicit
(`last-day` or `skip`), never inferred.

## Reminder

| Field | Type | Rules |
|---|---|---|
| `id` | opaque ID | not derived from email/content |
| `version` | positive integer | incremented for every state-changing write |
| `status` | ReminderStatus | transition controlled by domain policy |
| `schedule` | ReminderSchedule | immutable anchor plus mutable next occurrence |
| `recipientRef` | opaque recipient ID | resolves only in trusted infrastructure |
| `contentCiphertext` | encrypted bytes | key version stored separately |
| `deliveryPlan` | DeliveryPlan | bounded attempts and eligibility |
| `createdAt` / `updatedAt` | UTC instant | server generated |

## ReminderStatus and transitions

```text
draft -> pending_verification -> active -> completed
                              \-> cancelled
                              \-> expired
active -> snoozed -> active
active -> cancelled
active -> completed
```

- Invalid, expired, or consumed tokens do not create status transitions.
- Completed, cancelled, expired, suppressed, or unsubscribed reminders cannot send.
- Reschedule and snooze increment `version`; stale actions fail safely and return the
  latest non-sensitive view.

## DeliveryPlan

| Field | Type | Rules |
|---|---|---|
| `channel` | `email` | fixed at launch |
| `untilDone` | boolean | requires minimum interval and stopping bound |
| `maxAttempts` | integer | required when `untilDone` is true |
| `stopAt` | UTC instant or null | optional additional bound |
| `dailyQuota` | integer | server-owned safety value |
| `lastProviderEventId` | string or null | idempotency/audit only |

## CapabilityPreset

| Field | Type | Rules |
|---|---|---|
| `id` | `online \| email \| recurring \| meeting \| deadline \| follow-up` | closed launch set |
| `intent` | localized text key | unique outcome, not a keyword substitution |
| `example` | localized example | distinct per capability |
| `defaults` | partial ReminderDraft | validated by the same draft schema |
| `visibleOptions` | option ID[] | only controls disclosure, never domain availability |
| `metadata` | SEO metadata | unique title, description, canonical, hreflang |

## ReminderView

Minimal presentation projection returned by application use cases.

| Field | Type | Exposure rule |
|---|---|---|
| `publicState` | active/completed/cancelled/expired/invalid | invalid states reveal no existence detail |
| `title` | string or null | returned only for a valid management token |
| `localDueLabel` | localized string or null | includes date, time, and full IANA zone |
| `utcDueLabel` | string or null | unambiguous UTC form |
| `availableActions` | action[] | derived server-side from current state |
| `version` | integer or null | submitted for optimistic concurrency |

## UI governance entities

### DesignToken

`name`, `category`, `semanticPurpose`, `cssValue`, and `deprecatedBy`. Raw visual values
are permitted only inside the token source and explicitly allowlisted technical files.

### InteractionStateContract

Each interactive component records supported `default`, `hover`, `focus`, `active`,
`disabled`, `pending`, `success`, and `error` behavior. Non-applicable states require a
short rationale in the component test.

### GovernedException

`ruleId`, `owner`, `rationale`, `risk`, `expiresWhen`, `removalTask`, and `affectedPaths`.
Expired or incomplete exceptions fail architecture checks.
