# Verification: Reminder Web Foundation

**Date**: 2026-08-10
**Runtime**: Cloudflare Vite/Workers local runtime at `http://127.0.0.1:5173`
**Result**: PASS for the local implementation and Cloudflare deploy dry-run

## Acceptance walkthrough

- Opened the home and deadline-reminder routes in the in-app browser and confirmed meaningful server-rendered headings, examples, labels, controls, and primary actions.
- Completed create → exact local/IANA/UTC review → email verification → secure management → Done in Chromium and mobile Chromium.
- Confirmed invalid management links show a non-revealing state and no reminder content.
- Confirmed the deadline preset exposes one-day and seven-day lead offsets and recurring exposes a repeat schedule through the shared composer.
- Inspected the responsive page at a 918 px desktop viewport and corrected intermediate-width input overflow and checkbox styling.
- Rechecked at 320 px: `innerWidth=320`, `documentElement.scrollWidth=320`; the main action remained reachable with no horizontal page overflow.
- Captured default, focus, reduced-motion, pending, error, and success evidence for desktop and mobile under Playwright test artifacts.

## Automated evidence

`npm run verify` passed as the single ordered quality entry point:

- Prettier: all configured files matched.
- ESLint: no findings.
- Dependency Cruiser: 72 modules / 88 dependencies, zero violations.
- Architecture, design-token, contract-version, governed-exception, and constitution guards: passed.
- TypeScript and React Router route generation: passed.
- Vitest: 18 files, 37 tests passed, including production-response verification-token redaction.
- React Router production client and Worker build: passed.
- Public bundle budget: 108,438 / 143,360 bytes JS gzip; 3,478 / 30,720 bytes CSS gzip.
- Local D1 migrations: `0001_reminders.sql`, `0002_recipient_suppressions.sql`, and `0003_delivery_claims.sql`; no pending migrations.
- Playwright: 30 desktop/mobile tests passed, including axe serious/critical filtering, server HTML, localized capability pages, creation, management, performance, and visual-state evidence.
- `./scripts/validate-governance.sh`: passed after the full verification run.

## Cloudflare preview proof

`wrangler deploy --dry-run` completed successfully against the generated Worker build. It validated the deploy artifact, static asset directory, and these bindings:

- `REMINDER_WORKFLOW` → `ReminderWorkflow`
- `REMINDER_QUEUE` → `reminder-delivery`
- `DB` → D1 `reminder-work`
- `EMAIL` → Send Email
- `ASSETS` → static assets
- `APP_ORIGIN`, `TURNSTILE_SITE_KEY`, and `EMAIL_FROM` variables

The local Cloudflare runtime smoke path exercised D1 persistence, one-time verification tokens, Workflow creation, secure management tokens, encrypted-content retrieval, optimistic state updates, outbox writes, and terminal completion. Delivery safety tests separately proved retry recovery, version/terminal/suppression precedence, idempotent claims, and log redaction.

## Production-only follow-up

No remote deployment or real email was sent during local acceptance. Before production release, provision the real D1/Queue/Workflow resources, verify the Email Routing sender/domain, set `CONTENT_ENCRYPTION_KEY` and Turnstile secrets with Wrangler, replace the placeholder D1 ID and local `APP_ORIGIN`, apply migrations remotely, and run the same smoke path on the preview URL.
