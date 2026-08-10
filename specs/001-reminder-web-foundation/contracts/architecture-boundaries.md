# Architecture Boundary Contract

## Allowed dependency matrix

| From | May import | Must not import |
|---|---|---|
| `domain/**` | concrete modules within `domain/**` | React, router, browser, HTTP, Cloudflare, D1, CSS, presentation, infrastructure |
| `application/**` | `domain/**`, `application/ports/**` | presentation, concrete infrastructure, Cloudflare bindings |
| `infrastructure/**` | domain types, application ports, concrete infrastructure peers | presentation; infrastructure types must not escape port return values |
| `presentation/**` | application use cases/contracts, domain display-safe values, presentation peers | concrete infrastructure; domain policy implemented in routes/components |
| `worker.ts` | route/runtime composition and infrastructure constructors | new business policy |

Imports in `domain` and `application` target concrete files; broad `index.ts` barrels
are forbidden. Circular dependencies are forbidden across the repository.

## Automated guard composition

`npm run architecture:check` must run all of the following:

1. dependency-cruiser rules for layer direction, forbidden frameworks, and cycles;
2. ESLint restricted-import rules with the affected import and rule ID;
3. `scripts/check-design-tokens.mjs` for raw color, spacing, shadow, font, radius, and
   motion values outside the token source/allowlist;
4. `scripts/check-contract-versions.mjs` for persisted and asynchronous schemas;
5. constitution/spec placeholder validation.

Exit status is non-zero for violations. Output includes rule ID, source path, imported
path or offending value, and the shortest recovery hint.

## Representative negative fixtures

Contract tests intentionally exercise and expect rejection of:

- `domain` importing React or a Cloudflare binding;
- a route importing a D1 adapter directly;
- a cycle between application modules;
- an application/domain barrel import;
- raw `#fff`, arbitrary `13px` spacing, or undeclared duration in component CSS;
- a queue/persisted schema lacking `schemaVersion`;
- an incomplete or expired governed exception.

Fixtures live under `tests/contract/fixtures/invalid/` and are excluded from production
compilation except when the guard test invokes them.

## Governed exceptions

Exceptions are YAML or JSON records under `docs/architecture/exceptions/` containing:
`ruleId`, `owner`, `rationale`, `risk`, `expiresWhen`, `removalTask`, and `affectedPaths`.
Wildcards broader than a feature directory are forbidden. An exception does not suppress
security, secret, accessibility, or unversioned-contract rules. Expiry is a removal
condition or ISO date and is checked automatically.

## Git and CI enforcement

- Pre-commit runs staged secret/diff checks, governance validation, and the future
  `guard:staged` script when present.
- Pre-push runs governance validation and the future `verify` script when present.
- CI runs format, lint, architecture, typecheck, unit/integration, build,
  accessibility, and critical browser gates in that order.
- Hooks accelerate feedback; CI is authoritative and cannot be bypassed by a local
  `--no-verify`.
