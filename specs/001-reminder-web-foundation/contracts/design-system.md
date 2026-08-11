# Design System Contract

## Direction

Reminders.work feels like a precise workday instrument. The scheduled instant is the
strongest datum; the time rail connects definition, waiting, due point, and completion.
Surfaces are quiet and editorial, not a card-filled administration dashboard.

## Required semantic tokens

```css
:root {
  --color-canvas: #f7f8fa;
  --color-surface: #ffffff;
  --color-ink: #111827;
  --color-muted: #667085;
  --color-signal: #2457ff;
  --color-due: #d97706;
  --color-complete: #138a5b;
  --font-display: "Sora", sans-serif;
  --font-interface: "IBM Plex Sans", sans-serif;
  --font-time: "IBM Plex Mono", monospace;
  --space-1: 0.5rem;
  --space-2: 1rem;
  --space-3: 1.5rem;
  --space-4: 2rem;
  --motion-fast: 120ms;
  --motion-normal: 180ms;
  --motion-slow: 220ms;
}
```

The implementation may add semantic error, border, focus, disabled, radius, elevation,
and responsive tokens before use. Component CSS consumes semantic tokens only; raw
visual values require an allowlisted technical reason. Fonts are self-hosted and use
subset/preload strategy appropriate to English and Chinese content.

## Composition rules

- One primary signal-blue action per page region; destructive actions are never styled
  as the primary path.
- The time rail is used for sequence or time comprehension, not as decorative wallpaper.
- Scheduled date/time uses the mono face and stronger scale/contrast than metadata.
- Spacing follows the 8 px rhythm. Dense management actions may use 4 px only inside a
  documented token, never as an ad hoc value.
- Shared components expose explicit variants or composable slots, not boolean clusters.
- Border, shadow, and radius remain restrained; hierarchy relies first on spacing,
  typography, and surface contrast.

## Component acceptance template

Every interactive component documents and tests:

| State | Required evidence |
|---|---|
| default/hover/active | hierarchy remains clear; hover is not required to discover function |
| focus | visible at 3:1 adjacent contrast and never clipped |
| disabled | reason available in nearby text when users need recovery |
| pending | duplicate action prevented; layout and focus remain stable |
| error | text identifies problem and recovery; color is supplemental |
| success | durable textual result and valid next action |
| reduced motion | no essential information lost |

## Visual review matrix

For each changed journey, capture desktop and 320 px mobile views for the normal path,
keyboard focus, error, pending, and success states. Review at 200% zoom and reduced
motion. A visual change is incomplete if the capture does not show the scheduled instant
and primary action hierarchy clearly.
