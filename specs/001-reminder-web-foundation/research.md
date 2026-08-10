# Research: Reminder Web Foundation

## Decision 1: React Router framework mode on Cloudflare Workers

**Decision**: Use React Router framework mode with Vite and the Cloudflare Vite plugin.
Public routes render meaningful HTML on the Worker; loaders and actions own request
coordination and call application use cases.

**Rationale**: One routing model supports SSR, progressive form enhancement, localized
metadata, app routes, and a single Worker deployment without creating a separate API
service.

**Alternatives considered**:

- Client-only SPA: rejected because public content and critical form semantics must
  remain meaningful without client JavaScript and SEO pages need server HTML.
- Astro plus a React island: rejected because it creates two page/action conventions
  for a product whose public and management journeys share one composer vocabulary.
- Next.js: rejected because the Cloudflare-first runtime is the architectural driver,
  not compatibility with a second hosting model.

## Decision 2: CSS Modules with semantic CSS custom properties

**Decision**: Use CSS Modules for component-scoped rules and a small, versioned semantic
token sheet for color, typography, spacing, radius, elevation, motion, and focus.

**Rationale**: The visual system is compact and distinctive. Native CSS keeps the public
bundle small, makes responsive and reduced-motion behavior explicit, and enables a
simple repository guard against undeclared raw values.

**Alternatives considered**:

- Utility-first CSS: rejected for the foundation because unrestricted arbitrary values
  weaken the declared visual vocabulary and add toolchain surface.
- Large component library: rejected because a generic dashboard aesthetic conflicts
  with the time-instrument direction and most components would be single-use wrappers.
- CSS-in-JS runtime: rejected because it adds public JavaScript and SSR coordination for
  styling that static CSS can express.

## Decision 3: Layered modular monolith with executable boundaries

**Decision**: Keep one project and one deployment. Enforce dependency direction with
TypeScript strictness, ESLint restricted imports, dependency-cruiser cycle/layer rules,
and repository scripts for contract versions and design tokens.

**Rationale**: The boundaries correspond to different reasons to change while avoiding
premature packages or services. A single `architecture:check` command provides fast,
actionable enforcement locally, in hooks, and in CI.

**Alternatives considered**:

- Convention and review only: rejected because the specification requires
  representative violations to fail automatically.
- Monorepo packages for each layer: rejected because package publishing and workspace
  configuration add complexity without independent ownership or deployment.
- Microservices: rejected because scale and release ownership do not justify network
  boundaries or distributed consistency costs.

## Decision 4: Server-owned data with local interaction state only

**Decision**: Loaders/actions and application use cases own reminder state. React local
state holds only incomplete composer input, disclosure state, focus, and optimistic
feedback that can be reconciled from the action result. No global client state library.

**Rationale**: This prevents stale duplicates of versioned reminder state and makes
refresh, back navigation, token links, and server validation deterministic.

**Alternatives considered**:

- Global client store: rejected because the launch journeys do not require offline
  editing and the server is authoritative.
- Client query cache as source of truth: rejected because it would duplicate loader
  semantics for a small number of routes.

## Decision 5: Boundary validation with Zod

**Decision**: Parse form data, environment bindings, persisted JSON, and queue/workflow
payloads at their boundaries with versioned Zod schemas. Domain constructors still
enforce business invariants.

**Rationale**: Runtime inputs are untrusted even in a typed project. Versioned schemas
give actionable errors and make persisted/message contracts visible to the guard.

**Alternatives considered**:

- TypeScript types only: rejected because types disappear at runtime.
- Hand-written validators: rejected because error shape and contract evolution would be
  inconsistent across forms and Cloudflare events.

## Decision 6: Accessibility and visual proof as release artifacts

**Decision**: Use semantic HTML and native controls first, test components with Testing
Library, run axe-core in critical Playwright journeys, and capture desktop/mobile plus
reduced-motion and error/success screenshots.

**Rationale**: The acceptance criteria include keyboard, screen reader semantics,
320 px, 200% zoom, and state completeness. Static linting alone cannot prove those
journeys.

**Alternatives considered**:

- Manual review only: rejected because regressions would not block merge reliably.
- Snapshot tests as visual proof: rejected because DOM snapshots do not demonstrate
  layout, focus visibility, motion preference, or state hierarchy.

## Decision 7: Capability pages are configuration, not forks

**Decision**: Store each capability as validated content plus a typed `CapabilityPreset`
consumed by the same composer. English is canonical; Chinese content is a translated
peer with hreflang, never a separate behavior implementation.

**Rationale**: This makes SEO intent testable while preserving one canonical reminder
model and preventing keyword-only pages or divergent form logic.

**Alternatives considered**:

- Copy one form per landing page: rejected because validation, accessibility, and domain
  behavior would drift.
- Generic landing template with title substitution: rejected because every indexed page
  must demonstrate distinct intent, example, and defaults.

## Decision 8: Cloudflare services remain behind application ports

**Decision**: Use D1, Workflows, Queues, Email Service, Turnstile, and observability
through infrastructure adapters. D1 transactions and an outbox coordinate work;
messages carry opaque identifiers and versions only.

**Rationale**: This uses the paid Cloudflare platform directly while keeping business
rules testable and retries safe under at-least-once execution.

**Alternatives considered**:

- Direct binding access from routes/domain: rejected because it leaks runtime concerns
  and makes policy tests dependent on Cloudflare.
- External database or job platform: rejected because no launch requirement exceeds
  the selected Cloudflare capabilities.
