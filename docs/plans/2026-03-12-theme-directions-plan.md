# Theme Directions Plan

## Scope

This plan focuses on theme directions that are not already substantially covered by the current built-in set.

Themes already close enough to skip as full new-theme plans:

- `Graphite Terminal` is already the nearest match for the Command Line / Terminal direction.
- `Midnight Blueprint` is already the nearest match for the Blueprint / Architectural Draft direction.

Those two may still deserve later refinement passes, but they do not need first-pass concept planning right now.

## Implementation Progress

### Milestone 1 — E-Ink / Digital Paper (Completed)

- Added built-in theme `e-ink-digital-paper` with warm paper neutrals and charcoal-first contrast tokens.
- Added theme-scoped CSS to remove atmospheric overlays and background texture (`body::before` and `app-frame::before` disabled).
- Flattened shell/surface vocabulary by removing blur and shadow from `topbar-shell`, `sidebar-shell`, `panel-surface`, and `panel-muted`.
- Strengthened monochrome state clarity with heavier active emphasis and explicit border language for controls/chips.

Nuance:

- Accent is intentionally near-neutral (not colorful) so state communication remains shape/weight/border driven.

### Milestone 2 — Cupertino / Frosted Glass (Completed)

- Added built-in theme `cupertino-frosted-glass` with cool-neutral base and single saturated system-blue accent.
- Added glass shell treatments for `topbar-shell` and `sidebar-shell` with stronger blur, translucent fills, and softened edge treatment.
- Added lighter elevation behavior through softened shadows and reduced panel contrast deltas.
- Restyled segmented control and pill treatment with more rounded/toggle-like language and tighter active-state polish.
- Extended glass vocabulary to shared surfaces (`panel-surface` / `panel-muted`) so command palette, settings cards, and modals follow the same material family.

Nuance:

- Blur/saturation was tuned to preserve readability first; translucency is present but intentionally restrained.

### Milestone 3 — Cyberpunk / Synthwave (Completed)

- Added built-in theme `cyberpunk-synthwave` with a blue-black base and constrained dual-accent strategy (primary neon + secondary cyan focus).
- Added theme-specific shell glow and contrast edge treatment for top bar and sidebar while keeping panel separation crisp.
- Added restrained glow emphasis for active/selected surfaces rather than global neon treatment.
- Reinforced energetic visual tone through ambient background accents while preserving text-first readability.

Nuance:

- Glow is intentionally scoped to emphasis surfaces and active states to avoid fatigue during long task sessions.

### Milestone 4 — Validation (Completed)

- Ran `npm run build` successfully (Vite production build passed).
- Ran `npm test` successfully (17/17 tests passing).

Nuance:

- Build produced an existing bundle-size warning from Vite (`>500 kB` chunk), but no functional regressions or test failures.

## 1. Cupertino / Frosted Glass

### Goal

Create a theme that feels native to a premium desktop OS, with restrained translucency, soft hierarchy, and very polished interaction states.

### Visual Direction

- Use a clean neutral base with high clarity: cool whites, pale greys, graphite text.
- Reserve a single saturated accent for active states and focus treatment.
- Keep contrast strong enough that the app does not become “washed glass.”

### Theme-System Work

- Add a theme-specific shell treatment for `topbar-shell` and `sidebar-shell` with stronger `backdrop-filter`, translucent fills, and softened borders.
- Add support for lighter elevation language: softer shadows, less contrast between `panelBg` and `panelAltBg`, cleaner overlays.
- Consider adding a small set of optional theme variables later if current tokens are too limiting for glass intensity and shadow softness.

### Component-Level Styling Pass

- Restyle segmented controls and pills to look like native toggles instead of generic Tailwind-like buttons.
- Tighten icon sizing, spacing, and hover/pressed states so interactions feel “OS-level,” not web-app-level.
- Make command palette, modals, and settings cards align with the same glass vocabulary.

### Risks

- Too much blur or transparency will hurt readability.
- If the borders remain too sharp, the theme will feel like a web imitation instead of a polished native environment.

### Success Criteria

- The app feels at home beside a modern desktop app.
- The shell chrome looks translucent and elevated without hurting text clarity.
- Active controls feel deliberate and premium rather than decorative.

## 2. E-Ink / Digital Paper

### Goal

Create the calmest, lowest-stimulation theme in the set: matte, monochrome, distraction-free, and highly legible for long planning sessions.

### Visual Direction

- Use warm off-white backgrounds and charcoal text only.
- Keep accents nearly absent; state changes should rely on weight, fill, outline, and strike treatments.
- Remove decorative lighting, glow, and glossy effects entirely.

### Theme-System Work

- Add a theme-specific rule set that disables atmospheric overlays and reduces background texture to nearly zero.
- Flatten `panel-surface`, `panel-muted`, and shell treatments so every layer feels like the same material family.
- Ensure borders and focus states still remain accessible without relying on bright color.

### Component-Level Styling Pass

- Make selected states rely on solid fills, stronger borders, and text-weight shifts.
- Review task completion, selection, and hover states so they remain obvious in monochrome.
- Rework chips, badges, and counters so they do not rely on accent color to communicate state.

### Risks

- The theme could become too visually dead if hierarchy is removed too aggressively.
- Checkbox, drag, and selection states may become ambiguous without careful contrast work.

### Success Criteria

- The theme feels restful and focused, not unfinished.
- Long reading and task-planning sessions feel easier on the eyes.
- All critical interaction states remain obvious in grayscale.

## 3. Cyberpunk / Synthwave

### Goal

Add one intentionally dramatic dark theme that feels playful, high-energy, and tech-native without turning the app into unreadable neon noise.

### Visual Direction

- Use a very dark blue-black or violet-black base.
- Limit the palette to one primary neon and one secondary accent to avoid chaos.
- Keep typography readable and let the spectacle come from edges, glow, and state transitions.

### Theme-System Work

- Add theme-specific shell styling for glow, contrast edges, and stronger ambient background treatment.
- Introduce restrained glow rules for focus, active states, and high-priority controls.
- Keep panel separation crisp so the app still reads as a productivity tool, not a poster.

### Component-Level Styling Pass

- Rework toggles, counters, and status indicators so they feel like hardware LEDs or console indicators.
- Tighten task-row active/selected states to use contrast and glow sparingly.
- Make search, command palette, and timer affordances especially strong, since they fit the theme naturally.

### Risks

- Too many glowing elements will crush readability and make the interface tiring.
- Neon accents can easily overpower task content and hierarchy.

### Success Criteria

- The app feels energetic and opinionated while still usable for real work.
- Glow is used as emphasis, not as a default treatment for everything.
- Important actions feel vivid without drowning out text content.

## Notes

### Existing Theme Follow-Ups

`Graphite Terminal`

- Could evolve further by switching more controls from rounded pills to sharp rails and bracket-style affordances.
- Could optionally add a block-cursor treatment for active inputs and more explicit monospace-first typography.

`Midnight Blueprint`

- Could evolve further by increasing drafting-table cues: stronger white/cyan linework, more deliberate geometric typography, and more engineered shell spacing.
- Could also reuse some of the notebook/grid alignment work, but with cleaner technical drafting language instead of paper metaphors.

### Recommended Order

1. `E-Ink / Digital Paper`
2. `Cupertino / Frosted Glass`
3. `Cyberpunk / Synthwave`

Reasoning:

- `E-Ink` is the cleanest counterweight to the current notebook exploration and likely the least risky.
- `Cupertino` will test whether the shell can support a premium native aesthetic without heavy component rewrites.
- `Cyberpunk` is the most style-sensitive and easiest to overdo, so it is better once the theme hooks are more mature.
