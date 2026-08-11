# Tasks: Reminder Web Foundation

**Input**: Design documents in `specs/001-reminder-web-foundation/`
**Tests**: Required by the constitution and written before the behavior they protect.

## Format

Each task uses `- [ ] T### [P?] [US#?] Description with exact file path`.
`[P]` means the task can run in parallel with adjacent tasks because it owns different
files and has no unfinished dependency. Story labels appear only on story-scoped work.

## Phase 1: Project Setup

- [x] T001 Create the Node/TypeScript project manifests and required scripts in `package.json`, `tsconfig.json`, and `vite.config.ts`
- [x] T002 Configure the Cloudflare Worker, Static Assets, local D1, Queue, Workflow, Email, and Turnstile bindings in `wrangler.jsonc`
- [x] T003 [P] Add React Router route discovery and Worker entry composition in `react-router.config.ts` and `src/worker.ts`
- [x] T004 [P] Add formatting, linting, and dependency boundary configuration in `.prettierrc.json`, `eslint.config.js`, and `.dependency-cruiser.cjs`
- [x] T005 [P] Add Vitest, Testing Library, Playwright, and axe test configuration in `vitest.config.ts`, `playwright.config.ts`, and `tests/setup.ts`
- [x] T006 Add an idempotent hook installer and update hook documentation in `scripts/install-git-hooks.sh` and `.githooks/README.md`
- [x] T007 Wire `guard:staged`, `architecture:check`, and `verify` commands into the existing hooks through `package.json`

**Checkpoint**: The empty application builds, the local Worker starts, and both tracked
hooks invoke project commands only for Reminders.work changes.

## Phase 2: Foundational Architecture and Design System

**Purpose**: Shared contracts required by every story. No story implementation starts
until this phase is green.

- [x] T008 Write failing contract tests for forbidden layer imports and cycles in `tests/contract/architecture-boundaries.test.ts` and `tests/contract/fixtures/invalid/`
- [x] T009 [P] Write failing contract tests for raw visual values in `tests/contract/design-token-boundaries.test.ts` and `tests/contract/fixtures/invalid/raw-values.module.css`
- [x] T010 [P] Write failing contract tests for unversioned schemas and incomplete exceptions in `tests/contract/version-governance.test.ts` and `tests/contract/fixtures/invalid/`
- [x] T011 Implement layer, cycle, concrete-import, and exception checks in `.dependency-cruiser.cjs` and `scripts/check-architecture.mjs`
- [x] T012 [P] Implement raw design-value enforcement in `scripts/check-design-tokens.mjs`
- [x] T013 [P] Implement persisted/message schema-version enforcement in `scripts/check-contract-versions.mjs`
- [x] T014 Define semantic color, type, spacing, radius, focus, elevation, and motion tokens in `src/styles/tokens.css`
- [x] T015 [P] Add accessible reset, self-hosted Sora/IBM Plex font declarations, and preload metadata in `src/styles/reset.css`, `src/styles/fonts.css`, and `public/fonts/`
- [x] T016 Define versioned Zod boundary schemas and stable action-result errors in `src/application/contracts/action-result.ts` and `src/application/contracts/schema-version.ts`
- [x] T017 Define time, schedule, recurrence, reminder status, and transition domain types in `src/domain/time/` and `src/domain/reminder/`
- [x] T018 [P] Define application ports for reminder persistence, consent, scheduling, delivery, token, and clock behavior in `src/application/ports/`
- [x] T019 Add domain boundary tests for DST gaps/folds, month-end rules, and legal status transitions in `tests/unit/domain/`
- [x] T020 Add the accessible application shell, skip link, metadata helpers, and time-rail primitive in `src/presentation/ui/` and `src/presentation/routes/root.tsx`
- [x] T021 Configure CI gate ordering and artifact retention in `.github/workflows/verify.yml`

**Checkpoint**: Negative fixtures fail for the intended rule, production source passes,
and the shell renders at 320 px with semantic tokens and no client-global state.

## Phase 3: User Story 1 — Create a reminder with confidence (P1)

**Goal**: A first-time visitor can review an exact scheduled instant and reach email
verification in under 60 seconds.

**Independent test**: Complete the home-page composer on phone and desktop with pointer,
keyboard, and no-script HTML; verify clear DST and field-error recovery.

### Tests for User Story 1

- [x] T022 [P] [US1] Write composer schema and exact-time resolution unit tests in `tests/unit/reminder-composer.test.ts` and `tests/unit/time-resolution.test.ts`
- [x] T023 [P] [US1] Write create-reminder use-case tests for Turnstile, consent, idempotency, and safe errors in `tests/unit/create-reminder.test.ts`
- [x] T024 [P] [US1] Write D1/outbox and Turnstile adapter integration tests in `tests/integration/create-reminder-adapters.test.ts`
- [x] T025 [P] [US1] Write keyboard, 320 px, 200% zoom, validation-focus, and no-script browser tests in `tests/e2e/create-reminder.spec.ts`

### Implementation for User Story 1

- [x] T026 [US1] Implement local-time resolution, DST choice, and canonical schedule creation in `src/domain/time/resolve-local-time.ts` and `src/domain/reminder/create-schedule.ts`
- [x] T027 [US1] Implement the create-reminder use case and versioned input contract in `src/application/use-cases/create-reminder.ts` and `src/application/contracts/create-reminder.ts`
- [x] T028 [US1] Implement D1 reminder/outbox repositories and initial migrations in `src/infrastructure/cloudflare/d1/` and `migrations/0001_reminders.sql`
- [x] T029 [P] [US1] Implement the Turnstile adapter with fail-closed errors in `src/infrastructure/cloudflare/turnstile/verify-turnstile.ts`
- [x] T030 [US1] Implement the shared composer's What, When, Who, Review, and Delivery sections in `src/presentation/features/reminder-composer/`
- [x] T031 [US1] Implement error summary, field recovery, pending, and verification-success states in `src/presentation/features/reminder-composer/ReminderComposer.tsx` and `ReminderComposer.module.css`
- [x] T032 [US1] Implement the SSR home route and progressive create action in `src/presentation/routes/home.tsx` and `src/presentation/routes/actions/create-reminder.ts`
- [x] T033 [US1] Implement verification token issue/consume flow and safe verification route in `src/application/use-cases/verify-reminder.ts`, `src/infrastructure/cloudflare/tokens/`, and `src/presentation/routes/verify.tsx`

**Checkpoint**: US1 passes independently with exact local/IANA/UTC review, safe
verification state, and no reliance on client JavaScript for meaning.

## Phase 4: User Story 2 — Act on a reminder without friction (P2)

**Goal**: A recipient can understand state and complete, snooze, reschedule, cancel, or
unsubscribe without entering a dashboard.

**Independent test**: Open valid and invalid representative management links at 320 px;
complete or snooze an active reminder in two decisions or fewer.

### Tests for User Story 2

- [x] T034 [P] [US2] Write management projection and action-policy unit tests in `tests/unit/manage-reminder.test.ts`
- [x] T035 [P] [US2] Write stale-version, idempotency, suppression, and outbox integration tests in `tests/integration/manage-reminder-adapters.test.ts`
- [x] T036 [P] [US2] Write active/completed/cancelled/expired/invalid link browser tests in `tests/e2e/manage-reminder.spec.ts`

### Implementation for User Story 2

- [x] T037 [US2] Implement minimal ReminderView projection and available-action policy in `src/application/use-cases/get-reminder-view.ts`
- [x] T038 [US2] Implement Done, Snooze, Reschedule, and Cancel use cases with version checks in `src/application/use-cases/manage-reminder/`
- [x] T039 [US2] Implement recipient suppression and idempotent unsubscribe in `src/application/use-cases/unsubscribe.ts` and `src/infrastructure/cloudflare/d1/suppression-repository.ts`
- [x] T040 [US2] Implement secure management and unsubscribe token adapters in `src/infrastructure/cloudflare/tokens/management-token.ts`
- [x] T041 [US2] Implement the recipient state header, time rail, and explicit action compositions in `src/presentation/features/reminder-management/`
- [x] T042 [US2] Implement management actions and non-revealing invalid states in `src/presentation/routes/manage.tsx` and `src/presentation/routes/actions/manage-reminder.ts`
- [x] T043 [US2] Implement the idempotent unsubscribe route and confirmation in `src/presentation/routes/unsubscribe.tsx`

**Checkpoint**: US2 passes independently; stale or invalid links leak no sensitive data,
and terminal/suppressed reminders cannot present or trigger delivery actions.

## Phase 5: User Story 3 — Enter through the right capability page (P3)

**Goal**: Six search-intent pages demonstrate real differentiated reminder capabilities
through one shared composer.

**Independent test**: Compare routes and confirm unique content, example, defaults,
metadata, and hreflang while component identity and canonical Reminder output stay shared.

### Tests for User Story 3

- [x] T044 [P] [US3] Write preset schema, differentiation, and canonical output tests in `tests/unit/capability-presets.test.ts`
- [x] T045 [P] [US3] Write metadata, canonical, hreflang, noindex, and server-HTML contract tests in `tests/contract/public-routes.test.ts`
- [x] T046 [P] [US3] Write all English/Chinese capability page browser tests in `tests/e2e/capability-pages.spec.ts`

### Implementation for User Story 3

- [x] T047 [US3] Define and validate the six typed capability presets in `src/content/capability-presets.ts`
- [x] T048 [P] [US3] Author distinct canonical English content for six capabilities in `src/content/en/`
- [x] T049 [P] [US3] Author Chinese translations with matching intent and examples in `src/content/zh-CN/`
- [x] T050 [US3] Implement the shared capability-page composition and metadata contract in `src/presentation/features/capability-page/`
- [x] T051 [US3] Register English and `/zh/*` routes with canonical/hreflang behavior in `src/presentation/routes/capabilities.tsx` and `react-router.config.ts`
- [x] T052 [US3] Add `robots.txt`, sitemap generation, and noindex coverage for token/app routes in `public/robots.txt` and `scripts/generate-sitemap.mjs`

**Checkpoint**: US3 passes independently; no indexed route is a title-only keyword
variation and every preset produces the canonical reminder contract.

## Phase 6: User Story 4 — Extend without drift (P4)

**Goal**: Maintainers receive fast, actionable failures for architectural, visual,
accessibility, or contract drift.

**Independent test**: Run every negative fixture and observe the named rule/path; add one
valid capability preset without creating a parallel model or shared abstraction.

### Tests for User Story 4

- [x] T053 [P] [US4] Add guard CLI output and exit-code tests for every rule family in `tests/contract/guard-diagnostics.test.ts`
- [x] T054 [P] [US4] Add component interaction-state and accessibility contract tests in `tests/accessibility/component-contracts.test.tsx`
- [x] T055 [P] [US4] Add governed-exception expiry and path-scope tests in `tests/contract/governed-exceptions.test.ts`

### Implementation for User Story 4

- [x] T056 [US4] Complete actionable rule IDs, locations, recovery hints, and staged-file filtering in `scripts/check-architecture.mjs`, `scripts/check-design-tokens.mjs`, and `scripts/check-contract-versions.mjs`
- [x] T057 [US4] Add the governed-exception schema and documentation in `docs/architecture/exceptions/schema.json` and `docs/architecture/exceptions/README.md`
- [x] T058 [US4] Add an interaction-state test helper and explicit component variants in `tests/helpers/interaction-contract.ts` and `src/presentation/ui/`
- [x] T059 [US4] Make `npm run verify` the single ordered local/CI quality entry point in `package.json` and `.github/workflows/verify.yml`

**Checkpoint**: US4 passes independently and representative violations fail before
merge with actionable output.

## Phase 7: Cloudflare Delivery, Performance, and Release Proof

- [x] T060 Add versioned Workflow and Queue message schemas plus current-state reload in `src/infrastructure/cloudflare/workflows/` and `src/infrastructure/cloudflare/queues/`
- [x] T061 Add Email Service adapter and redacted structured observability in `src/infrastructure/cloudflare/email/` and `src/infrastructure/cloudflare/observability/`
- [x] T062 Add integration tests for at-least-once retries, terminal-state precedence, and log redaction in `tests/integration/delivery-safety.test.ts`
- [x] T063 [P] Add public route bundle and Core Web Vitals budget checks in `scripts/check-performance-budget.mjs` and `tests/e2e/performance.spec.ts`
- [x] T064 [P] Capture desktop/mobile, focus, reduced-motion, pending, error, and success evidence in `tests/visual/reminder-foundation.spec.ts` and CI artifacts
- [x] T065 Run the documented local acceptance walkthrough and record results in `specs/001-reminder-web-foundation/verification.md`
- [x] T066 Run a Cloudflare preview smoke path from create through completion and record binding/migration evidence in `specs/001-reminder-web-foundation/verification.md`
- [x] T067 Run `npm run verify` and `./scripts/validate-governance.sh`, resolve all failures, and record final evidence in `specs/001-reminder-web-foundation/verification.md`

## Dependencies and Execution Order

- Phase 1 blocks all later phases.
- Phase 2 blocks all user stories because it defines the domain vocabulary, boundaries,
  tokens, and test harness.
- US1 is the MVP and blocks US2 where management needs created/verified reminders.
- US3 can start after Phase 2 and the shared composer contract, but its final browser tests
  require US1.
- US4 builds on the foundational guards and can proceed alongside US2/US3 after Phase 2.
- Phase 7 requires US1 and US2; final verification requires all stories.

Within each story, test tasks must fail for the intended missing behavior before the
corresponding implementation task begins. Tasks marked `[P]` have distinct file
ownership and may be executed concurrently.

## MVP Scope

The smallest production-useful slice is T001–T033: toolchain and guards, design/domain
foundation, the home-page composer, exact time review, Turnstile, D1/outbox persistence,
and email verification state. It is deployable and independently proves the primary
Reminders.work promise before management and SEO expansion.
