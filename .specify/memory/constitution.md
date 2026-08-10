<!--
Sync Impact Report
- Version change: template -> 1.0.0
- Added principles:
  - I. Reminder Relevance Before Breadth
  - II. Time and Delivery Correctness
  - III. Consent and User Control
  - IV. Distinctive, Calm, Accessible UI
  - V. Enforced Frontend Boundaries
  - VI. Cloudflare-Native, D1-Authoritative Runtime
  - VII. Tests and Evidence Before Completion
- Added sections:
  - Product, UI, and Frontend Standards
  - Delivery Workflow and Quality Gates
- Removed sections: none (initial ratification)
- Deferred items: none
-->
# Reminder.work Constitution

## Core Principles

### I. Reminder Relevance Before Breadth

Every product capability MUST directly strengthen at least two of these three axes:
Reminder, Work, and Web; it MUST score highest on Reminder. The core product remains
one Reminder model serving task, meeting, deadline, and follow-up presets. Features
such as project boards, chat, CRM, marketing mail, and generic AI assistants MUST NOT
enter implementation without a new specification and an explicit constitution review.

Public search pages MUST expose a real, corresponding capability in the shared reminder
composer. Pages MUST NOT exist only to exchange keywords. This keeps product behavior,
domain naming, information architecture, and search intent aligned.

### II. Time and Delivery Correctness

Time is a domain value, never an incidental string. Every scheduled reminder MUST have
a valid IANA time zone and a deterministic UTC instant. Recurrence MUST derive from its
original local-time anchor rather than the previous delivery time. DST gaps, DST folds,
month-end overflow, lead offsets, snooze, and retry limits MUST have explicit behavior
and automated boundary tests.

D1 is the business source of truth. Workflow wakeups and Queue messages MUST reload
current status and version before producing a side effect. Cancellation, completion,
unsubscribe, hard bounce, and complaint MUST take precedence over queued delivery.
No reminder may fail silently: stale non-terminal work MUST be detectable and recoverable.

### III. Consent and User Control

The service MUST send only to an address controlled and verified by the recipient.
Anonymous creation MUST require server-validated Turnstile and email verification.
The sender, template, and HTML MUST NOT be user-controlled. Every reminder email MUST
offer completion, cancellation, and unsubscribe actions appropriate to its state.

`until_done` MUST have a minimum interval, a maximum attempt count or stop time, and a
daily quota. Hard bounce, complaint, unsubscribe, and abuse suppression MUST block all
later sends before content is decrypted. Security controls MUST fail closed for new
sends while allowing safe read-only management where possible.

### IV. Distinctive, Calm, Accessible UI

The visual direction is **a precise workday instrument**, not a generic SaaS dashboard.
The interface MUST make the scheduled instant the visual focus and use a recurring
"time rail" motif to connect creation, waiting, delivery, and acknowledgement. Decorative
elements MUST encode time, status, or sequence; decoration without product meaning MUST
be removed.

The baseline design system is:

- Canvas `#F7F8FA`, surface `#FFFFFF`, ink `#111827`, muted `#667085`.
- Signal blue `#2457FF` for the single primary action, due amber `#D97706`, and
  completion green `#138A5B`; components MUST consume semantic tokens rather than raw
  colors.
- Sora for restrained display headings, IBM Plex Sans for interface/body text, and
  IBM Plex Mono for dates, durations, and time-zone data. Fonts MUST be self-hosted.
- An 8 px spacing rhythm, minimum 44 px interactive targets, visible focus, and no
  information conveyed by color alone.
- Motion MUST explain state change, stay within 120–220 ms for normal interactions,
  avoid layout-triggering properties, and honor `prefers-reduced-motion`.

Every user journey MUST work at 320 px width, with keyboard only, at 200% zoom, and with
screen-reader labels. Public HTML MUST retain meaningful content and form semantics when
client JavaScript is unavailable. WCAG 2.2 AA is the release floor.

### V. Enforced Frontend Boundaries

Frontend code MUST follow this dependency direction:

```text
presentation/routes -> application/use-cases -> domain
infrastructure/adapters ----------------------> ports <- application
```

The domain layer MUST NOT import React, routing, Cloudflare, D1, HTTP, browser globals,
or styling code. Routes coordinate data and compose features; they MUST NOT contain time
calculation, recurrence, authorization, or delivery policy. Infrastructure implements
ports and MUST NOT leak Cloudflare binding types into domain contracts.

Features MUST be organized by user capability, not by generic technical buckets.
Shared UI is limited to proven reuse across at least two features. Components MUST use
explicit variants or composition rather than accumulating behavior booleans. Imports
MUST target concrete modules; broad barrel exports are prohibited in application and
domain code. Server state MUST have one owner and MUST NOT be copied into a global client
store without a documented offline or optimistic-interaction requirement.

Architecture boundaries MUST be executable: TypeScript strict mode, ESLint restricted
imports, cycle detection, and a CI architecture check MUST fail when dependency direction
is violated. Exceptions require an ADR with owner, expiry condition, and removal task.

### VI. Cloudflare-Native, D1-Authoritative Runtime

Production MUST use Workers Paid with Workers Static Assets, D1, Workflows, Queues,
Email Service, Turnstile, and Cloudflare observability. Email MUST use the `env.EMAIL`
binding directly. Cron MUST reconcile exceptional state only; it MUST NOT become the
primary scheduler or perform unbounded full-table scans.

Cross-service operations MUST assume at-least-once execution and no distributed
transaction. D1 transactions plus an outbox, idempotency keys, conditional claims, and
provider event IDs MUST make retries safe. Queue payloads MUST contain identifiers, not
email addresses or reminder content. Sensitive content MUST be application-encrypted,
key-versioned, and absent from logs and analytics.

The project remains one deployable modular monolith until measured limits, independent
release ownership, or contractual isolation justify a split. New services and external
runtime dependencies require an ADR and evidence that the existing platform cannot meet
the requirement.

### VII. Tests and Evidence Before Completion

Every behavior change MUST begin with acceptance criteria and automated tests at the
lowest effective level. Time, recurrence, state transitions, consent, idempotency, and
suppression require domain or integration tests before production implementation.
Critical journeys require browser tests: create, verify, receive, complete, snooze,
cancel, and unsubscribe.

A change is not complete until lint, strict typecheck, unit tests, integration tests,
browser tests relevant to the change, production build, architecture checks, and
accessibility checks pass. Visual work additionally requires responsive screenshots and
a visual review against the design specification. Claims MUST cite the command or
artifact that proves them.

## Product, UI, and Frontend Standards

- English is the canonical public language; Chinese uses `/zh/*` and valid hreflang.
- Public pages MUST use SSR or prerendered HTML, unique canonical metadata, and the same
  Reminder Composer with capability-specific presets.
- `/app/*`, management tokens, and unsubscribe routes MUST be excluded from indexing.
- Each page has one primary action. Secondary actions MUST remain visually subordinate.
- Copy MUST use active, literal verbs: Create reminder, Save changes, Snooze, Done,
  Cancel. “Submit” and vague success/error copy are prohibited.
- Every form field MUST have a persistent label, useful example, inline validation,
  error summary, autocomplete where valid, and a deterministic focus target on failure.
- Loading, empty, error, offline, expired-token, rate-limited, and success states MUST be
  designed before the happy-path component is accepted.
- UI state MUST be representable by URLs where users reasonably expect refresh, back,
  sharing, or deep linking to preserve context.
- Performance budgets at launch: public-route JavaScript SHOULD stay below 150 KB gzip,
  no avoidable request waterfalls, LCP SHOULD be below 2.5 seconds at the 75th percentile,
  and CLS SHOULD remain below 0.1.
- Dates and numbers MUST use platform internationalization APIs. Hand-built locale
  formatting and ambiguous time-zone abbreviations are prohibited.
- No dependency may be added merely for a single trivial component or helper. Reuse Web
  Platform, React, and existing utilities first.

## Delivery Workflow and Quality Gates

Every feature follows the Spec Kit sequence:

1. Constitution check: identify applicable MUST rules and any requested exceptions.
2. Specification: user stories, edge cases, measurable outcomes, and explicit exclusions.
3. Plan: technical context, data model, UI contract, API contract, and validation guide.
4. Tasks: dependency-ordered, story-scoped tasks with exact file paths and test tasks.
5. Analysis: cross-artifact coverage and constitution alignment before implementation.
6. Implementation: smallest vertical slice first; tests and architecture gates stay green.
7. Visual verification: desktop, mobile, keyboard, reduced-motion, and error-state review.

Required CI gates are:

```text
format-check -> lint -> architecture-check -> typecheck -> unit/integration tests
             -> build -> accessibility checks -> critical browser tests
```

Architecture-check MUST at minimum reject forbidden layer imports, dependency cycles,
domain imports of platform/framework modules, unapproved raw design-token values, and
unversioned Queue or persisted-data contracts. A failing mandatory gate blocks merge.

## Governance

This constitution overrides feature specs, plans, tasks, coding-agent suggestions, and
local conventions. Conflicts MUST be resolved by changing the lower-authority artifact.

Amendments require:

1. A written rationale and affected principles.
2. A semantic version change: MAJOR for removed/redefined principles, MINOR for new or
   materially expanded rules, PATCH for clarification.
3. A migration plan for existing code/specs when compliance changes.
4. Updated Sync Impact Report and constitution date.

Every plan MUST include a Constitution Check before and after design. Every review MUST
verify architecture direction, consent, time correctness, UI accessibility, test evidence,
and scope relevance. Temporary exceptions require an ADR, owner, risk statement, expiry
condition, and tracked removal task. Complexity without measured need is non-compliant.

**Version**: 1.0.0 | **Ratified**: 2026-08-10 | **Last Amended**: 2026-08-10
