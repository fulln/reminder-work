# Implementation Plan: Reminder Web Foundation

**Branch**: `001-reminder-web-foundation` | **Date**: 2026-08-10 | **Spec**: [spec.md](./spec.md)

## Summary

Build the first coherent Reminders.work web surface: six intent-specific public pages,
a shared reminder composer, secure management states, and an enforceable frontend
architecture. The product will be a TypeScript modular monolith deployed to Cloudflare
Workers Paid. React Router framework mode provides server-rendered public HTML and form
actions; Cloudflare D1 remains authoritative while Workflows, Queues, Email Service, and
Turnstile are accessed only through infrastructure adapters. CSS Modules consume a
small semantic-token system whose time-rail motif makes scheduled time and state the
visual signature. Automated import, cycle, token, contract, accessibility, and browser
checks guard the design before merge.

## Technical Context

**Language/Version**: TypeScript 5.x in strict mode; modern ECMAScript on the Cloudflare Workers runtime
**Primary Dependencies**: React 19, React Router framework mode, Vite, Cloudflare Vite plugin, Zod, dependency-cruiser
**Storage**: Cloudflare D1 as business source of truth; Static Assets for immutable web assets
**Testing**: Vitest, React Testing Library, Miniflare/Wrangler integration tests, Playwright, axe-core
**Target Platform**: Cloudflare Workers Paid; evergreen browsers with meaningful server-rendered fallback
**Project Type**: Server-rendered web application and Worker API in one deployable modular monolith
**Performance Goals**: p75 LCP <2.5 s, CLS <0.1, public-route JS <150 KB gzip, no avoidable request waterfalls
**Constraints**: WCAG 2.2 AA; 320 px and 200% zoom; 44 px targets; English canonical plus `/zh/*`; D1 authoritative; at-least-once delivery; no sensitive content in logs
**Scale/Scope**: launch foundation for six capability pages, creation/verification and recipient-management journeys; design target 10k active users without service decomposition

## Constitution Check

*GATE: Passed before research and re-checked after Phase 1 design.*

| Principle | Design evidence | Result |
|---|---|---|
| Reminder relevance | One Reminder model and one composer serve online, email, recurring, meeting, deadline, and follow-up presets. | PASS |
| Time and delivery correctness | Time parsing and recurrence remain domain values; adapters reload versioned D1 state before effects. | PASS |
| Consent and control | Verification, Turnstile, suppression, minimal token pages, and explicit recipient actions are contractual. | PASS |
| Calm accessible UI | Semantic tokens, time rail, self-hosted fonts, state matrices, 320 px/200%/keyboard/reduced-motion tests are specified. | PASS |
| Frontend boundaries | Layer matrix, concrete imports, dependency-cruiser, ESLint, and custom guards are defined in contracts. | PASS |
| Cloudflare-native runtime | One Worker deployment uses Static Assets, D1, Workflows, Queues, Email Service, and Turnstile behind ports. | PASS |
| Evidence before completion | Unit, integration, contract, accessibility, visual, and critical Playwright gates are included in the task plan. | PASS |

No constitution exception is required. Post-design review confirms that contracts do
not introduce a second reminder model, client-global server state, external runtime, or
unowned architecture exception.

## Project Structure

### Documentation (this feature)

```text
specs/001-reminder-web-foundation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api-contract.md
│   ├── architecture-boundaries.md
│   ├── design-system.md
│   └── ui-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── worker.ts
├── domain/
│   ├── reminder/
│   └── time/
├── application/
│   ├── ports/
│   └── use-cases/
├── infrastructure/
│   └── cloudflare/
│       ├── d1/
│       ├── email/
│       ├── queues/
│       ├── turnstile/
│       └── workflows/
├── presentation/
│   ├── routes/
│   ├── features/
│   │   ├── reminder-composer/
│   │   └── reminder-management/
│   └── ui/
├── content/
│   ├── en/
│   └── zh-CN/
└── styles/
    ├── tokens.css
    ├── reset.css
    └── fonts.css

tests/
├── unit/
├── integration/
├── contract/
├── accessibility/
├── e2e/
└── visual/

scripts/
├── check-architecture.mjs
├── check-contract-versions.mjs
└── check-design-tokens.mjs
```

**Structure Decision**: Use one Cloudflare-deployable TypeScript project with explicit
domain, application, infrastructure, and presentation boundaries. Product capabilities
live under `presentation/features`; `presentation/ui` contains only demonstrated reuse.
The structure preserves a single deployment while allowing dependency direction to be
checked mechanically.

## Delivery Strategy

1. Establish toolchain, tokens, layout primitives, import rules, and deliberate failing
   guard fixtures before product components.
2. Deliver the P1 vertical slice from home page through validated composer and
   verification state, including D1/Turnstile ports and no-script semantics.
3. Add token-based recipient management and state-safe actions for P2.
4. Add the six public capability presets and localized SEO metadata for P3.
5. Close P4 with guard regression fixtures, full CI orchestration, accessibility,
   performance, and visual evidence.

Each slice must remain deployable. Cloudflare bindings receive local test doubles;
domain tests do not require Wrangler or network access.

## Complexity Tracking

No constitution violations require justification.
