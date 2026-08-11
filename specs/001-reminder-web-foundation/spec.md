# Feature Specification: Reminder Web Foundation

**Feature Branch**: `001-reminder-web-foundation`

**Created**: 2026-08-10

**Status**: Accepted

**Input**: User description: "Establish the frontend UI style, web experience,
frontend architecture standards, and code-guarding requirements for Reminders.work."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a reminder with confidence (Priority: P1)

As a first-time visitor, I can understand what Reminders.work does, enter a reminder,
review its exact local and universal time, and proceed to email verification without
installing an application or learning a task-management system.

**Why this priority**: The creation journey is the product's primary value and the
conversion target of every public page.

**Independent Test**: Starting from the home page on a phone or desktop, a new visitor
can create one valid reminder, identify when it will fire, and reach the verification
state in under 60 seconds using pointer, keyboard, or supported assistive technology.

**Acceptance Scenarios**:

1. **Given** a visitor on the home page, **When** they enter a title, email, date, time,
   and time zone, **Then** they see an unambiguous summary before creating the reminder.
2. **Given** an incomplete or invalid form, **When** the visitor tries to continue,
   **Then** each error explains what must change and focus moves to a useful error target.
3. **Given** a keyboard-only visitor at 200% zoom, **When** they complete the journey,
   **Then** every control remains visible, operable, and ordered logically.
4. **Given** client scripting is unavailable, **When** a visitor opens a public page,
   **Then** the product purpose, capability explanation, labels, and next action remain
   understandable.
5. **Given** a browser that supports Web Push, **When** the visitor explicitly chooses
   browser delivery, **Then** permission is requested only from that action and a system
   test notification confirms the selected device.
6. **Given** a browser-only reminder, **When** creation succeeds, **Then** it activates
   without email verification and uses the same durable schedule as an email reminder.
7. **Given** browser plus email fallback, **When** Push cannot be delivered, **Then** the
   occurrence is delivered through the verified email without duplicating a successful
   target.
8. **Given** a reviewed or created reminder, **When** the visitor chooses Add to calendar,
   **Then** the browser downloads an importable `.ics` file without changing reminder
   activation, verification, or delivery state.

---

### User Story 2 - Act on a reminder without friction (Priority: P2)

As a reminder recipient, I can open a secure link and immediately understand the
reminder state, due time, and available actions: Done, Snooze, Reschedule, or Cancel.

**Why this priority**: Reliable delivery only creates value when the recipient can close
or intentionally defer the work loop.

**Independent Test**: From a representative reminder management link, a recipient can
complete or snooze a reminder on a 320 px viewport and receives a clear, persistent
result without navigating through an unrelated dashboard.

**Acceptance Scenarios**:

1. **Given** an active reminder, **When** its management page opens, **Then** the exact
   time and current state have stronger visual prominence than secondary metadata.
2. **Given** an active reminder, **When** the recipient marks it Done, **Then** the page
   confirms completion and no longer presents actions that imply it is active.
3. **Given** an active reminder, **When** the recipient chooses Snooze, **Then** they can
   select or enter a new time and review the resolved time zone before saving.
4. **Given** an expired, cancelled, completed, or invalid link, **When** it opens,
   **Then** the page explains the state without revealing account or reminder details.

---

### User Story 3 - Enter through the right work-reminder page (Priority: P3)

As a search visitor looking for an online, email, recurring, meeting, deadline, or
follow-up reminder, I land on a page that demonstrates that exact capability and opens
the same trusted composer with useful defaults for my intent.

**Why this priority**: Capability pages are the acquisition surface, but they must serve
the same coherent product rather than become disconnected keyword pages.

**Independent Test**: Each public capability page contains distinct explanatory content,
a relevant example, and a preset that changes the composer meaningfully while producing
the same canonical Reminder result.

**Acceptance Scenarios**:

1. **Given** a visitor on the recurring reminder page, **When** they open the composer,
   **Then** repeat controls and a recurring example are present by default.
2. **Given** a visitor on the deadline reminder page, **When** they open the composer,
   **Then** multiple lead reminders and remind-until-done are explained and available.
3. **Given** two capability pages, **When** their content is compared, **Then** they have
   distinct user intent, examples, and defaults rather than title-only differences.
4. **Given** a public page in English or Chinese, **When** a search system reads it,
   **Then** canonical language relationships and indexability are unambiguous.

---

### User Story 4 - Extend the interface without drift (Priority: P4)

As a maintainer, I can add or change a reminder capability while reusing the visual
language, interaction vocabulary, accessibility behavior, and shared reminder rules;
changes that violate declared boundaries are rejected before merge.

**Why this priority**: A consistent interface and architecture must remain enforceable
after the first implementation rather than depend on reviewer memory.

**Independent Test**: A conforming small UI change passes the documented quality gates;
representative violations of dependency direction, design tokens, accessibility, or
contract versioning are rejected with actionable messages.

**Acceptance Scenarios**:

1. **Given** a new capability preset, **When** it uses the shared reminder vocabulary and
   composer, **Then** it can be reviewed without creating a parallel reminder model.
2. **Given** a change that places scheduling policy inside presentation code, **When**
   quality gates run, **Then** the change is rejected and the violated boundary is named.
3. **Given** a component using an undeclared visual value, **When** quality gates run,
   **Then** the change is rejected or requires an explicit governed exception.
4. **Given** a deliberate architecture exception, **When** it is reviewed, **Then** its
   owner, rationale, risk, expiry condition, and removal work are documented.

### Edge Cases

- A selected local time does not exist or occurs twice because of daylight-saving time.
- A monthly reminder selects a day absent from a later month.
- The visitor changes time zone after choosing a date and time.
- Content expands substantially in Chinese or at 200% text zoom.
- A form submission is pending, succeeds late, fails, or is retried.
- The verification or management token is expired, already consumed, malformed, or for a
  suppressed email address.
- The user prefers reduced motion, high contrast, or has disabled client scripting.
- A narrow screen contains a long title, long time-zone name, or multiple validation
  errors.
- Public content is available while reminder creation is temporarily unavailable.
- A new page proposes a keyword that does not map to a distinct product preset.
- Notification permission is denied, revoked, unsupported, or available only after
  installing the site as a Home Screen web app.
- A Push endpoint is malformed, transiently unavailable, or permanently returns 404/410.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The home page MUST state the product purpose and expose the primary reminder
  creation action without requiring navigation or account creation.
- **FR-002**: The creation experience MUST collect reminder content, verified-recipient
  email, schedule, time zone, and applicable delivery/acknowledgement choices.
- **FR-003**: Before creation, the experience MUST show the resolved local date, local
  time, IANA time zone, and a universal-time representation.
- **FR-004**: Validation MUST identify every invalid field, explain recovery in plain
  language, preserve valid input, and provide a useful focus destination.
- **FR-005**: The critical create, verify, manage, complete, snooze, reschedule, cancel,
  and unsubscribe journeys MUST be operable by keyboard and supported assistive
  technology.
- **FR-006**: Public pages MUST retain meaningful product content, headings, labels, and
  navigation when client scripting is unavailable.
- **FR-007**: The interface MUST use a single shared reminder composer whose presets can
  change defaults and visible options without changing the canonical reminder meaning.
- **FR-008**: Public capability pages MUST be limited to online, email, recurring,
  meeting, deadline, and follow-up reminders unless a later specification proves a new
  capability meets the project relevance gate.
- **FR-009**: Every capability page MUST provide distinct intent-specific explanation,
  example content, defaults, metadata, and a direct path to creation.
- **FR-010**: The interface MUST use a precise workday-instrument visual language in which
  scheduled time and reminder state are the primary visual anchors.
- **FR-011**: The visual system MUST define semantic roles for canvas, surface, text,
  muted text, primary action, due/overdue, completion, error, borders, focus, and disabled
  states; product UI MUST use these roles consistently.
- **FR-012**: Dates, times, durations, status changes, and sequences MUST use a consistent
  time-rail visual motif where that motif improves comprehension.
- **FR-013**: Every interactive element MUST define default, hover where applicable,
  focus, active, disabled, pending, success, and error behavior.
- **FR-014**: Motion MUST communicate state or spatial change, respect reduced-motion
  preferences, and never be required to understand or complete a task.
- **FR-015**: The experience MUST remain usable at 320 px viewport width, 200% zoom, and
  with minimum 44 px interactive targets.
- **FR-016**: Every page or component with asynchronous behavior MUST define loading,
  empty, error, recovery, and success states before implementation is accepted.
- **FR-017**: User-facing actions MUST use consistent active labels, including Create
  reminder, Save changes, Done, Snooze, Reschedule, Cancel, and Unsubscribe.
- **FR-018**: Management and unsubscribe pages MUST minimize exposed reminder information
  and communicate expired, consumed, completed, cancelled, and invalid-link states safely.
- **FR-019**: Public English pages MUST be canonical; translated pages MUST declare their
  language relationship. Application, management, and unsubscribe pages MUST not be
  indexed.
- **FR-020**: Domain rules for schedule, recurrence, status, consent, acknowledgement,
  and delivery eligibility MUST remain independent from presentation behavior.
- **FR-021**: Dependency direction MUST be declared and automatically evaluated so that
  presentation cannot own domain policy and domain code cannot depend on presentation or
  runtime platform concerns.
- **FR-022**: Shared UI MUST be introduced only after reuse across at least two product
  capabilities is demonstrated; feature-specific behavior MUST remain with its feature.
- **FR-023**: Component variations MUST use explicit variants or composition rather than
  ambiguous combinations of behavior flags.
- **FR-024**: Server-owned reminder state MUST have a single source and MUST not be copied
  into unrelated client-global state without a documented interaction requirement.
- **FR-025**: Quality gates MUST reject unresolved specification placeholders, forbidden
  dependency direction, dependency cycles, undeclared visual values, inaccessible
  critical interactions, unversioned persisted/message contracts, and failing tests.
- **FR-026**: A governed exception MUST identify its owner, rationale, risk, expiry
  condition, and removal work.
- **FR-027**: Quality failures MUST report the violated rule and affected file or artifact
  sufficiently for a maintainer to take corrective action.
- **FR-028**: Likely secret files and sensitive reminder content MUST be prevented from
  entering version control or routine diagnostic output.
- **FR-029**: Delivery MUST support Email, Web Push, and Web Push with Email fallback
  without introducing a second Reminder scheduler.
- **FR-030**: Notification permission MUST be requested only after an explicit user
  action; denied or unsupported browsers MUST retain a complete Email path.
- **FR-031**: PushSubscription endpoint and key material MUST be validated, encrypted at
  rest, deduplicated, and revocable; permanent endpoint failures MUST stop retries.
- **FR-032**: Push payloads MUST omit reminder content and recipient identity by default,
  and notification clicks MUST navigate only to an opaque management URL.
- **FR-033**: Delivery idempotency MUST be scoped per occurrence and target so one target
  can retry or fall back without duplicating a target that already succeeded.
- **FR-034**: A Push-only reminder MUST activate after device subscription and abuse
  checks; any reminder containing Email MUST remain inactive until email verification.
- **FR-035**: Calendar export MUST remain a stateless Schedule boundary conversion and
  MUST NOT be represented as a Delivery channel or a second scheduling source.
- **FR-036**: Calendar export MUST use POST and a fixed attachment filename so reminder
  content, schedule data, and management tokens do not enter URLs or routine logs.
- **FR-037**: Exported files MUST preserve IANA time-zone, one-time and supported
  recurrence semantics, text escaping, stable UID, and at least one display alarm.
- **FR-038**: Calendar export failure MUST NOT block or mutate reminder review, creation,
  verification, scheduling, or delivery.

### Key Entities

- **Reminder Composer**: The shared user journey for defining one canonical reminder;
  receives a capability preset but owns no delivery implementation details.
- **Capability Preset**: Intent-specific defaults, visible options, examples, and copy for
  online, email, recurring, meeting, deadline, or follow-up reminder use.
- **Design Token**: A named semantic visual role shared across pages and components.
- **Interaction State Contract**: Required states and behavior for an interactive element
  or asynchronous view.
- **Architecture Boundary**: A declared permitted dependency direction between product
  layers or feature modules.
- **Quality Gate**: A reproducible acceptance rule that blocks a non-conforming change.
- **Governed Exception**: A temporary, owned deviation from a mandatory boundary or rule.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of representative first-time users can reach the reminder
  verification state in under 60 seconds without assistance.
- **SC-002**: All critical journeys are completable at 320 px width, 200% zoom, by keyboard
  only, and with supported screen-reader navigation.
- **SC-003**: In usability testing, at least 95% of participants correctly identify the
  scheduled local time and time zone before confirmation.
- **SC-004**: Every public capability page maps to one distinct, testable composer preset;
  no indexed page differs only by keyword or heading.
- **SC-005**: At least 90% of representative recipients can complete or snooze an active
  reminder in two decisions or fewer after opening its management link.
- **SC-006**: Automated critical-flow accessibility checks report zero serious or critical
  violations before release.
- **SC-007**: Public pages achieve 75th-percentile LCP below 2.5 seconds and CLS below 0.1
  under the agreed launch measurement profile.
- **SC-008**: Representative violations for every declared frontend boundary are rejected
  before merge with an actionable rule and location.
- **SC-009**: One documented verification command exercises formatting, architecture,
  type, tests, build, accessibility, and critical browser gates without manual assembly.
- **SC-010**: All visual changes have review evidence for desktop, mobile, keyboard focus,
  reduced motion, loading, error, and success states.
- **SC-011**: Browser notification enablement produces one visible system test
  notification in supported test environments and never prompts on initial page load.
- **SC-012**: Automated delivery tests prove Push success, Email fallback, target-level
  deduplication, and 404/410 subscription revocation.
- **SC-013**: Automated tests prove exported one-time, daily, weekly, and monthly files
  are parseable, contain no unescaped user-controlled lines, and retain local time-zone
  semantics at 320 px and desktop layouts.

## Assumptions

- English is the canonical public language and Chinese is the first translated language.
- Email and browser notification are the launch delivery channels; Calendar export is a
  separate user-initiated interoperability action.
- Anonymous visitors may create reminders only for an email address they verify.
- The visual signature is a time rail connecting schedule, due point, and acknowledgement.
- The first implementation covers responsive web; native apps and browser extensions are
  outside this feature.
- Public capability scope is limited to online, email, recurring, meeting, deadline, and
  follow-up reminders.
- The project constitution is authoritative when this specification and later plans
  conflict.
