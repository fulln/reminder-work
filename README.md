# Reminders.work

Free online reminders for tasks, meetings, and deadlines.

[![Verify](https://github.com/fulln/reminder-work/actions/workflows/verify.yml/badge.svg)](https://github.com/fulln/reminder-work/actions/workflows/verify.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Reminders.work is a focused, install-free reminder service. It lets people create an
email reminder from the web, verify the recipient, receive it at the correct local
time, and manage it through secure links.

## Capabilities

- One-time email reminders without installing an app
- Daily, weekly, and monthly recurrence
- Meeting, deadline, and follow-up presets
- Complete, snooze, reschedule, cancel, and unsubscribe flows
- IANA time-zone and daylight-saving-time handling
- English-first SEO pages with Chinese routes under `/zh/*`
- Keyboard, reduced-motion, mobile, and WCAG-oriented interaction coverage

## Architecture

The application is a Cloudflare-native modular monolith:

- React Router and TypeScript for server rendering and UI
- Cloudflare Workers and Static Assets for the application runtime
- D1 as the source of truth
- Workflows for durable scheduling
- Queues for delivery retries and idempotency
- Cloudflare Email Service for reminder delivery
- Turnstile for abuse prevention
- `fl-user-auth` through a Cloudflare Worker Service Binding for Google and
  GitHub OAuth, site-bound sessions, and logout revocation

Domain, application, infrastructure, and presentation boundaries are enforced in CI.
The detailed design is available in [docs/architecture.md](docs/architecture.md), and
the implementation specification lives in
[specs/001-reminder-web-foundation](specs/001-reminder-web-foundation).

## Local development

Requirements:

- Node.js 22 or newer
- npm

```bash
git clone https://github.com/fulln/reminder-work.git
cd reminder-work
npm ci
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

The local application is served at `http://127.0.0.1:5173` by default. Local
development uses Cloudflare's test Turnstile configuration and local Wrangler
resources; it does not send production email.

To exercise OAuth locally, also run the sibling
[`fl-user-auth`](https://github.com/fulln/fl-user-auth) Worker. Wrangler connects
the two processes through the configured `AUTH_SERVICE` binding:

```bash
cd ../fl-user-auth
npx wrangler d1 migrations apply fl_user_auth --local
npx wrangler dev --port 8787
```

The relying-site contract uses `reminder-work` and accepts only the exact
`/auth/callback` URLs registered by the authentication service. Session tokens
are validated server-side and stored only in an HttpOnly, SameSite=Lax cookie.

## Quality gates

```bash
npm run verify
```

The verification pipeline runs formatting, linting, dependency-boundary checks,
TypeScript, unit and integration tests, a production build, performance budgets, D1
migrations, accessibility checks, and Playwright browser tests.

Install the repository hooks with:

```bash
./scripts/install-git-hooks.sh
```

## Cloudflare deployment

Before deployment, replace the placeholder D1 ID in `wrangler.jsonc`, provision D1,
Queue, Workflow, Email, and Turnstile resources, deploy `fl-user-auth`, and configure
secrets:

```bash
npx wrangler secret put CONTENT_ENCRYPTION_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
npm run deploy
```

Apply migrations to the production database separately with Wrangler's `--remote`
flag. Review [the verification notes](specs/001-reminder-web-foundation/verification.md)
for the remaining production-release checks.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a
pull request. Security issues should follow [SECURITY.md](SECURITY.md).

## License

Released under the [MIT License](LICENSE).
