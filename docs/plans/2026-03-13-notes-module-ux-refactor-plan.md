# Notes Module UX Refactor Plan

## Goal

Refactor the notes system so it behaves more like a reusable contextual module and less like a separate destination that users have to consciously enter.

Target outcome:

- notes become a module that can render inside task panels
- the default contextual notes surface sits below the task list, not above it
- the notes surface works across day, today, project, area, and general task-list contexts
- the dedicated notes dashboard remains available as a library/archive view, but not as the primary way users discover and use notes

## Date

- Prepared: 2026-03-13

## Current Review Findings

### Data model is fine

The current note data model is not the main problem.

- `Note` is already a clean first-class entity in [src/types.ts](/home/vas/sites/node/toomuchtodo/src/types.ts).
- Scope is explicit and flexible through `scopeType` and `scopeRef`.
- Local persistence and sync are already properly integrated through:
  - [src/store/useAppStore.ts](/home/vas/sites/node/toomuchtodo/src/store/useAppStore.ts)
  - [src/lib/sync/operations.ts](/home/vas/sites/node/toomuchtodo/src/lib/sync/operations.ts)
  - [src/lib/sync/engine.ts](/home/vas/sites/node/toomuchtodo/src/lib/sync/engine.ts)
  - [worker/src/routes/sync.ts](/home/vas/sites/node/toomuchtodo/worker/src/routes/sync.ts)

Conclusion:

- do not redesign note storage first
- redesign note surfaces and integration boundaries first

### UX is split between a dashboard and a few panel shortcuts

Today notes are surfaced in three disconnected ways:

1. a dedicated sidebar `Notes` destination in [src/app/App.tsx](/home/vas/sites/node/toomuchtodo/src/app/App.tsx)
2. a full dashboard/editor in [src/features/notes/NotesDashboardView.tsx](/home/vas/sites/node/toomuchtodo/src/features/notes/NotesDashboardView.tsx)
3. top-of-panel note affordances in [src/features/tasks/TaskPanelWrapper.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskPanelWrapper.tsx)

That combination is what feels unintuitive.

Why:

- the dashboard is a separate mental mode
- project notes currently appear as chips near the top of the panel
- day and area notes are mostly reached through a button rather than felt as part of the work surface
- notes do not have one predictable place inside the task workflow

### `TaskPanelWrapper` is already the right integration seam

The current app already resolves context there:

- project scope
- day/today scope
- area scope
- notes link counts

That makes [src/features/tasks/TaskPanelWrapper.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskPanelWrapper.tsx) the right place to host a reusable notes module, just as it now hosts daily goals.

## Recommendation

Keep the existing `Note` entity and sync model, but refactor the UI into a small notes module that can mount inside task panels.

Recommended product structure:

- keep the notes dashboard as a library/archive view
- remove notes from the top-right/top-of-panel interaction model
- introduce a contextual `NotesModule` that renders below the task list
- make this module the default notes experience in day/project/area/general task contexts

This is the same architectural move that made daily goals cleaner:

- content remains first-class in state
- rendering becomes modular and surface-driven
- feature UX stops leaking across unrelated layout layers

## What Should Change Conceptually

### Current model

- notes are a separate place
- context panels contain shortcuts to that place

### Proposed model

- notes are part of the panel
- the dashboard is the full archive and management surface

This is a major usability improvement because users can treat notes as the tail-end of a work context, not a second app inside the app.

## Proposed UX

### Placement

Render notes below the task list inside task panels.

Contexts where the module should appear:

- day
- today
- project
- area
- general lists like inbox/next/all/focus/scheduled

Context mapping recommendation:

- `project` panel: scoped project notes
- `day` or `today` panel: scoped day notes
- `area` panel: scoped area notes
- general task views with no project/day/area context: dashboard notes or hidden by default

Recommendation for general views:

- only show notes when there is a clear scope
- do not automatically inject dashboard notes under every inbox/next/focus list in v1

That means the module appears for:

- day/today
- project
- area

and stays out of inbox/next/focus unless later proven useful.

### Module shape

The contextual notes module should be lightweight by default.

Recommended sections:

- small section kicker like `Notes`
- collapsed preview when empty or inactive
- one visible active note editor at a time
- a list of other notes in that scope below it, if more than one exists

Recommended interaction pattern:

- show the newest or pinned note expanded by default
- allow `Add note`
- allow switching between notes within the scope
- keep the dashboard as the place for global search/filtering and archive-style browsing

### Visual direction

The module should feel quieter than goals.

Recommended visual hierarchy:

- task list remains primary
- notes sit below as supporting context
- no large boxed "sub-app" feel
- no top-of-panel pill clutter

Good baseline:

- a thin divider before notes
- a small section kicker
- one editor block with calm spacing
- compact note list rows beneath

### Why below the task list is better

Putting notes below the tasks is more intuitive because:

- tasks remain the operational center
- notes read as reflections, context, scratchpad, or follow-up
- the panel flows from action to context instead of context interrupting action

This is especially important in day view, where goals and task blocks already own the top of the screen.

## Recommended Module Architecture

Add a dedicated notes module surface under `src/features/notes`:

```txt
src/features/notes/
  NotesModule.tsx
  ScopedNotesModule.tsx
  notesModuleRegistry.ts
  noteScopeResolvers.ts
```

Suggested responsibility split:

- `NotesModule.tsx`
  - generic presentational surface for a list of notes and one active editor
- `ScopedNotesModule.tsx`
  - resolves scope and feeds `NotesModule`
- `notesModuleRegistry.ts`
  - module registration pattern similar to daily goals
- `noteScopeResolvers.ts`
  - maps panel state to note scope descriptors

### Minimal registry pattern

Do not build a full plugin system.

Use the same narrow pattern as daily goals:

- one module object
- one render surface contract
- one settings flag if needed

Recommended flag:

- `contextualNotesEnabled: boolean`

That lets you:

- keep the dashboard even if contextual notes are off
- selectively stage rollout
- avoid hard-coding note-module rendering forever

## Recommended Scope Resolver

Create one helper that maps the current panel into a note scope:

```ts
type NotePanelScope =
  | { scopeType: 'project'; scopeRef: string }
  | { scopeType: 'day'; scopeRef: string }
  | { scopeType: 'area'; scopeRef: string }
  | null;
```

Resolver rules:

- if `panel.projectId`, return `project`
- else if `panel.view === 'day'` or `panel.view === 'today'`, return `day`
- else if `selectedArea`, return `area`
- else return `null`

This will remove the current duplicated scope logic from scattered note buttons/chips.

## What To Remove or Reduce

### Remove top-right notes button as the primary pattern

The `Notes` button in the panel action cluster is currently doing too much work for note discoverability.

Recommendation:

- remove it as the default contextual entry point
- optionally keep a very small `Open in Notes` secondary action inside the module itself

### Remove top-of-panel project-note chips

These are decorative previews, not a stable interaction model.

They should be replaced with the below-list module.

### Keep the sidebar Notes dashboard

Do not remove the dedicated notes dashboard entirely.

It still has value for:

- cross-scope browsing
- search
- managing pinned notes
- reviewing older notes

But it should become secondary, not the default note workflow.

## Store and Data Changes

### Required data changes

None required for the first UX refactor.

The current store API already supports:

- `addNote`
- `updateNote`
- `deleteNote`
- `toggleNotePinned`
- `getNotesByScope`

Potential additions:

- `getScopedNotes(scopeType, scopeRef, options?)`
- `getPrimaryScopedNote(scopeType, scopeRef)`

These would simplify module rendering, but are convenience helpers, not architectural changes.

### Optional settings change

Add to [src/types.ts](/home/vas/sites/node/toomuchtodo/src/types.ts):

```ts
contextualNotesEnabled: boolean;
```

Default:

```ts
contextualNotesEnabled: true;
```

Reason:

- this gives notes the same modular rollout shape as daily goals
- it keeps the implementation honest about being a surface module

## UI Refactor Plan

### Phase 1: Extract a reusable contextual notes module

- build `ScopedNotesModule`
- feed it from `TaskPanelWrapper`
- place it below `TaskListView`
- initially support:
  - showing scoped notes
  - add note
  - edit note
  - switch note
  - delete note
  - pin note

Success criteria:

- notes are usable without leaving the panel
- day/project/area panels all behave consistently

### Phase 2: Remove the current top-of-panel notes patterns

- remove project note chips from the panel top
- demote or remove the panel-top notes button
- keep PiP controls independent from notes

Success criteria:

- notes have one obvious location in-context
- the top of the panel is no longer cluttered by note affordances

### Phase 3: Reframe the dashboard as archive/library

- keep [NotesDashboardView.tsx](/home/vas/sites/node/toomuchtodo/src/features/notes/NotesDashboardView.tsx)
- update copy and interaction assumptions so it feels like a library view, not the main note editor
- optionally add "Open in dashboard" from module scope

Success criteria:

- dashboard still works
- primary editing happens in context

### Phase 4: Introduce module-style toggle and registry

- add `contextualNotesEnabled`
- add a small notes module registry file
- render from `TaskPanelWrapper` via the registry/surface pattern

Success criteria:

- notes and goals share a similar modular architecture
- note rendering is no longer a special-case ad hoc integration

## Detailed UX Recommendation

### For day view

Below the task list, show:

- `Notes`
- one expanded note if present
- otherwise a lightweight empty state:
  - `Add note`
  - optional `No notes for this day yet`

Do not place notes above goals or above morning/afternoon/evening blocks.

### For project view

Below the project task list, show project notes using the same structure.

This is much clearer than today’s chip row because:

- users can actually read/edit notes there
- the behavior matches day view

### For area view

Do the same for area notes, using the selected area string as scope ref.

### Editor behavior

Recommended first version:

- one expanded note editor at a time
- autosave is fine
- title input + markdown body
- supporting notes listed in compact rows below

Do not initially support:

- multiple expanded editors
- drag sorting notes within a scope
- heavy metadata UI

## Risks and Tradeoffs

### Risk: duplicating notes UI between dashboard and module

This is real.

Mitigation:

- extract shared editor content
- share note list row primitives where practical
- keep dashboard-specific search/filter controls outside the module

### Risk: too much content below task lists

Also real.

Mitigation:

- show only one expanded note at a time
- collapse older notes into compact rows
- keep the module visually calm

### Risk: dashboard and contextual module compete

Mitigation:

- define roles clearly
  - module = do notes in context
  - dashboard = browse/search/manage all notes

## Concrete File Impact

Primary implementation targets:

- [src/features/tasks/TaskPanelWrapper.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskPanelWrapper.tsx)
- [src/features/notes/NotesDashboardView.tsx](/home/vas/sites/node/toomuchtodo/src/features/notes/NotesDashboardView.tsx)
- [src/features/notes/NoteEditorCard.tsx](/home/vas/sites/node/toomuchtodo/src/features/notes/NoteEditorCard.tsx)
- [src/features/notes/noteUtils.ts](/home/vas/sites/node/toomuchtodo/src/features/notes/noteUtils.ts)
- [src/store/useAppStore.ts](/home/vas/sites/node/toomuchtodo/src/store/useAppStore.ts)
- [src/types.ts](/home/vas/sites/node/toomuchtodo/src/types.ts)

New files likely:

- [src/features/notes/ScopedNotesModule.tsx](/home/vas/sites/node/toomuchtodo/src/features/notes/ScopedNotesModule.tsx)
- [src/features/notes/NotesModule.tsx](/home/vas/sites/node/toomuchtodo/src/features/notes/NotesModule.tsx)
- [src/features/notes/notesModuleRegistry.ts](/home/vas/sites/node/toomuchtodo/src/features/notes/notesModuleRegistry.ts)
- [src/features/notes/noteScopeResolvers.ts](/home/vas/sites/node/toomuchtodo/src/features/notes/noteScopeResolvers.ts)

## Final Recommendation

Do not rewrite notes data storage. Rewrite notes presence.

The cleanest next move is:

1. keep `Note` as a first-class entity
2. extract notes into a module rendered from `TaskPanelWrapper`
3. move contextual notes below task lists
4. demote the standalone notes dashboard into a library/archive role
5. remove the current top-of-panel note clutter

That will make notes feel much more intuitive because they will stop being "somewhere else" and start feeling like part of the actual work surface.

## Implementation Progress (Completed)

### Phase 1 status: complete

- Added contextual notes module architecture under `src/features/notes/`:
  - `NotesModule.tsx`
  - `ScopedNotesModule.tsx`
  - `noteScopeResolvers.ts`
  - `notesModuleRegistry.ts`
- Integrated `ScopedNotesModule` into `TaskPanelWrapper` below `TaskListView`.
- Enabled in-panel notes workflows (add, edit, switch, delete, pin) for scoped contexts.

Nuance:

- Scope resolution is centralized and deterministic: `project` > `day/today` > `area` > `null`.

### Phase 2 status: complete

- Removed top-of-panel project note chips from `TaskPanelWrapper`.
- Removed top-right contextual `Notes` action button from panel actions.
- Kept Picture-in-Picture controls independent and unchanged.

Nuance:

- Notes now have one predictable in-panel location, reducing panel header clutter.

### Phase 3 status: complete

- Kept `NotesDashboardView` intact and updated copy to frame it as archive/library:
  - kicker: `Notes Library`
  - heading: `Notes Archive`
  - empty-state copy now references in-panel note creation.

### Phase 4 status: complete

- Added `contextualNotesEnabled` to `AppSettings` with default `true`.
- Wired setting persistence/import normalization in `useAppStore`.
- Added `toggleContextualNotesEnabled` in store API.
- Exposed setting toggle in `SettingsView` (Features section).
- Routed setting through `App.tsx` and gated rendering via notes module registry helper.

Nuance:

- Dashboard notes experience remains available regardless of contextual module toggle state.

### Validation status: complete

- `npm test` passed.
- `npm run build` passed.

## Post-Implementation UX Refinement (Completed)

Applied follow-up simplification to reduce contextual notes visual weight in task panels:

- Removed redundant in-note contextual headers/titles (scope badge + large title treatment).
- Removed nested boxed/card styling so notes read as inline panel content.
- Replaced persistent top-row action clutter with a subtle `...` overflow actions menu.
- Switched primary interaction to click-to-edit body text with an auto-expanding textarea.
- Kept `+ Add note` visible only for empty scopes; additional note creation remains available from overflow menu.

Validation:

- `npm test` passed.
- `npm run build` passed.

## Follow-up UX Iteration: Grid + Editing Guidance (Completed)

Applied a second refinement pass for better scanability and note lifecycle clarity:

- Contextual notes now render as a lightweight 2-column card grid (mobile falls back to 1 column).
- Preview mode renders markdown (minimal styling) inside each card.
- Edit mode includes explicit guidance: blur saves, `Ctrl/Cmd+Enter` saves+exits, `Esc` cancels.
- Added a persistent visible `+ Add note` action in the header for discoverability.
- Kept per-note management controls (`pin`, `delete`, `open in notes`) behind the `...` menu.

Validation:

- `npm test` passed.
- `npm run build` passed.

## Next Follow-up Plan (Pending)

Based on implementation review, three structural fixes are queued before continuing:

1. Empty ghost notes must not persist.
   - Switch ghost flow to draft-first behavior so a `Note` entity is only created once real content is entered.
2. Ghost slot must be last and stable.
   - Keep exactly one goals-style dashed ghost tile as the final grid item at all times.
3. Drag-and-drop reorder in scoped notes.
   - Add card-level drag/drop and persist scope-specific ordering in settings (scope-keyed note order), avoiding note schema/server migrations for this phase.

Validation gate after implementation:

- `npm test`
- `npm run build`

## Follow-up Plan Execution (Completed)

### Phase 1: Prevent empty ghost notes — complete

- Reworked ghost-note flow to be draft-first (local UI state), instead of creating a persisted `Note` immediately.
- New note records are now created only when draft content is non-empty on blur or `Ctrl/Cmd+Enter`.
- `Esc` cancels ghost drafting without creating any note record.

Nuance:

- This prevents empty-note pollution while keeping the "single click into edit mode" interaction.

### Phase 2: Keep ghost slot fixed at end — complete

- Kept a single goals-style dashed ghost slot as the final grid item.
- Ghost remains the last slot even as note cards reorder.

Nuance:

- While drafting a new note, the ghost slot transforms into an inline draft editor in that same final position.

### Phase 3: Drag-and-drop reorder for scoped notes — complete

- Added card-level drag/drop reordering in contextual notes grid.
- Persisted order per scope through `settings.contextualNotesOrder` using a scope key (`scopeType:scopeRef`).
- Scoped module now applies persisted order first and appends untracked notes deterministically.

Nuance:

- Ordering persistence is implemented in settings/state (and syncs via existing settings sync), avoiding a note schema migration for this phase.

### Phase 4: Validation — complete

- `npm test` passed.
- `npm run build` passed.

## UX Polish Sweep (Completed)

### Milestone A: Daily surface cleanup — complete

- Removed daily item/task count under day headers (`day` / `today` views).

### Milestone B: Goals readability polish — complete

- Improved unchecked goal checkbox affordance contrast (brighter border/background).
- Added truncation behavior to goal title input so fixed-width goal cards handle long text more predictably.

### Milestone C: Notes visual hierarchy + behavior polish — complete

- Increased top spacing before notes section.
- Made note card borders subtler and reduced heavy/double-border feel (including e-ink).
- Kept ghost slot as last tile, and refined it to resemble an empty note editor surface.
- Removed dependence on scope-default titles in card UI.

### Milestone D: Notes title behavior — complete

- Notes now derive title from the first meaningful line of body content.
- Derived title is shown at the top of each note card and persisted on note save/create.

### Validation

- `npm test` passed.
- `npm run build` passed.
