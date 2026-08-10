# UI Contract

## Route inventory

| Route | Indexing | Primary action | Required preset/state |
|---|---|---|---|
| `/` | canonical | Create reminder | online default |
| `/email-reminder` | index | Create email reminder | email |
| `/recurring-reminder` | index | Create recurring reminder | recurring |
| `/meeting-reminder` | index | Create meeting reminder | meeting |
| `/deadline-reminder` | index | Create deadline reminder | deadline |
| `/follow-up-reminder` | index | Create follow-up reminder | follow-up |
| `/zh/*` equivalents | index with hreflang | localized literal action | same preset as English peer |
| `/verify/:token` | noindex | Verify email | token state |
| `/manage/:token` | noindex | state-derived | minimal ReminderView |
| `/unsubscribe/:token` | noindex | Unsubscribe | minimal consent state |

Every indexed capability route has unique intent, example, defaults, title, description,
canonical URL, and English/Chinese language links. It composes the shared
`ReminderComposer`; it does not fork form or validation logic.

## Shared ReminderComposer contract

**Inputs**:

- `preset: CapabilityPreset`
- `initialDraft?: ReminderDraft`
- `locale: en | zh-CN`
- server action result when validation or submission has occurred

**Outputs**:

- standards-compatible form submission
- focus request for the first useful invalid field or error summary
- analytics event containing preset and outcome only, never reminder content or email

**Required sections**:

1. What: reminder title and intent-specific example.
2. When: local date, time, IANA time zone, recurrence/lead controls when relevant.
3. Who: recipient email and concise verification explanation.
4. Review: resolved local instant and UTC representation on the time rail.
5. Delivery: bounded acknowledgement/follow-up choices.

The form is progressively enhanced. Native form semantics, persistent labels, help,
and the primary submit action are present in server-rendered HTML. Client enhancement may
add instant time resolution and disclosure behavior but must not introduce a second
validation vocabulary.

## Interaction state matrix

| Surface | Loading/pending | Empty | Error | Success/recovery |
|---|---|---|---|---|
| Composer | fields retained; action disabled with textual status | valid initial preset | summary + inline errors, deterministic focus | verification instruction with masked recipient |
| Time preview | stable reserved layout | prompt to complete date/time/zone | explain DST gap/fold and correction | local + IANA zone + UTC shown together |
| Management | non-sensitive skeleton and title | not applicable | generic invalid/expired state | current state plus only permitted actions |
| Snooze/reschedule | action-level pending state | presets plus custom option | retain values and explain conflict/staleness | updated due time and persistent confirmation |
| Capability content | server HTML always present | not applicable | composer unavailable message with retry | preset applied visibly |

Every interactive element has visible focus, a 44 px minimum target, name/role/value,
and a state announcement where the visual change alone would be insufficient. Pending
actions prevent accidental duplicate activation without trapping keyboard focus.

## Responsive and accessibility behavior

- At 320 px, content is one column; the time rail becomes vertical and actions remain
  in DOM reading order.
- At 200% zoom, no two-dimensional scrolling is required for core content.
- Error summary receives programmatic focus after invalid submission and links to fields.
- Status changes use an appropriately scoped live region; initial page content is not
  redundantly announced.
- Motion is 120–220 ms and limited to opacity/transform where practical. Reduced-motion
  mode removes nonessential transition and preserves all state cues.
- Color is never the sole indicator for due, completion, error, selection, or focus.

## Copy vocabulary

Primary verbs are literal and stable: `Create reminder`, `Save changes`, `Done`,
`Snooze`, `Reschedule`, `Cancel`, and `Unsubscribe`. English is the source vocabulary;
translations preserve action meaning rather than word shape. Generic `Submit`, `OK`, or
unqualified `Success` labels are not permitted.

## Component ownership

- `presentation/features/reminder-composer` owns composer layout and local interaction.
- `presentation/features/reminder-management` owns recipient action composition.
- `presentation/ui` may contain only primitives already used by two capabilities.
- Routes own metadata, preset selection, loader/action coordination, and page composition.
- No presentation module calculates recurrence, authorizes actions, or chooses delivery
  eligibility.
