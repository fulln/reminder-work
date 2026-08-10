# Validation Quickstart

This feature is currently specification-first. The commands below are the required
developer contract for the implementation tasks; they become executable as the
corresponding toolchain files land.

## Local prerequisites

- Node.js 22 LTS and npm
- Wrangler authenticated only for remote preview/deployment; local tests use Miniflare
- A local `.dev.vars` containing non-production test values and never committed

## Expected workflow

```bash
npm install
npm run dev
npm run architecture:check
npm run verify
```

`verify` must orchestrate format check, lint, architecture check, strict typecheck,
unit/integration tests, production build, accessibility tests, and critical browser
tests. Individual gates remain runnable for focused diagnosis.

The repository hooks are installed with:

```bash
./scripts/install-git-hooks.sh
```

If the install helper is not yet present, the tracked `.githooks` can be linked using
the documented instructions in `.githooks/README.md`.

## Acceptance walkthrough

1. Open `/` at desktop width and 320 px. Confirm the product purpose, scheduled-time
   focus, and one primary creation action are immediately visible.
2. Complete the composer by keyboard. Confirm local date/time, full IANA zone, and UTC
   appear before submission; trigger both ordinary validation and a DST edge case.
3. Submit with a valid local Turnstile test response. Confirm valid input is retained and
   the result instructs email verification without exposing the full recipient.
4. Open representative active, completed, cancelled, expired, and invalid management
   URLs. Confirm only valid state exposes content and only permitted actions appear.
5. Exercise Done, Snooze, Reschedule, Cancel, and Unsubscribe, including a stale version
   conflict and duplicate submission.
6. Compare all six capability routes. Confirm each has unique intent/example/defaults
   and still renders the same composer implementation.
7. Repeat critical routes under `/zh/*`, no JavaScript, 200% zoom, keyboard-only, and
   reduced-motion settings.

## Guard proof

Run the contract suite against its invalid fixtures. The suite must demonstrate that
each representative forbidden import, cycle, raw token value, unversioned contract, and
expired exception fails with its rule ID and file path. Then run the same guards against
the production source and confirm zero violations.

## Cloudflare preview proof

Use local Wrangler bindings for D1, Workflows, Queues, Email Service stubs, and Turnstile
test keys. Before production deployment, apply D1 migrations to a preview database and
run create → verify → deliver stub → manage → complete as one traceable smoke journey.
No test output may contain a raw email address, management token, or reminder content.
