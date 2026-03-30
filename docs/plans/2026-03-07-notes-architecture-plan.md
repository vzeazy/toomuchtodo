# Notes Architecture Plan

## Goal

Add a unified notes system that supports:

- project-scoped notes
- area-scoped notes
- day-scoped notes
- a dedicated notes dashboard for browsing, creating, and searching notes

The implementation should fit the app's current local-first architecture, preserve optional cloud sync, and reuse the existing markdown editing pattern already used for task notes.

## Date

- Prepared: 2026-03-07

## Current Baseline

The current app already has one mature notes-like primitive: task descriptions.

- Tasks already store markdown-capable text in `description` in [src/types.ts](/home/vas/sites/node/toomuchtodo/src/types.ts).
- The task details panel already supports markdown editing and preview in [src/features/tasks/TaskModal.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskModal.tsx).
- A reusable markdown editor exists in [src/components/MarkdownEditor.tsx](/home/vas/sites/node/toomuchtodo/src/components/MarkdownEditor.tsx).
- The app state is still centered on `tasks`, `projects`, `settings`, `themes`, and `timer` in [src/types.ts](/home/vas/sites/node/toomuchtodo/src/types.ts).
- Sync currently only understands `task`, `project`, and `settings` entities in:
  - [src/types.ts](/home/vas/sites/node/toomuchtodo/src/types.ts)
  - [src/lib/sync/operations.ts](/home/vas/sites/node/toomuchtodo/src/lib/sync/operations.ts)
  - [worker/src/routes/sync.ts](/home/vas/sites/node/toomuchtodo/worker/src/routes/sync.ts)
- Projects are intentionally lightweight containers with no notes field today in [src/types.ts](/home/vas/sites/node/toomuchtodo/src/types.ts).
- Areas are not first-class records; they are currently strings attached to tasks and a static list in [src/app/App.tsx](/home/vas/sites/node/toomuchtodo/src/app/App.tsx).
- Days are also not first-class records; day views are derived from `dueDate` and optional `dayPart` in:
  - [src/app/App.tsx](/home/vas/sites/node/toomuchtodo/src/app/App.tsx)
  - [src/features/planner/PlannerView.tsx](/home/vas/sites/node/toomuchtodo/src/features/planner/PlannerView.tsx)

That means project notes, area notes, and day notes do not currently have a natural place to live if they are embedded directly into the existing models.

## Recommendation

Use a new first-class `Note` entity instead of trying to bolt notes onto `Project`, `settings`, or ad hoc day maps.

This is the cleanest approach because it gives one storage model for all note surfaces while keeping scope flexible.

Recommended note model:

- one `notes` collection in app state
- one `note` sync entity
- each note has a scope descriptor that determines where it belongs
- global notes are just notes with `scopeType = 'dashboard'`
- project notes use `scopeType = 'project'` and `scopeRef = project.id`
- area notes use `scopeType = 'area'` and `scopeRef = area name`
- day notes use `scopeType = 'day'` and `scopeRef = YYYY-MM-DD`

This is better than embedding for three reasons:

1. It avoids spreading note logic across projects, settings, and planner-only date maps.
2. It makes sync, deletion, search, pinning, sorting, and future backlinks all work the same way.
3. It creates a real notes dashboard naturally, instead of building one from stitched-together scope-specific blobs.

## Why Not Embed Notes Directly

### Project `description`

This would help only one scope. It does not solve area notes, day notes, or a global notes dashboard.

### `settings.areaNotes` or `settings.dayNotes`

This would overload `settings` with user content. That makes sync diffs coarse, creates merge pressure on one record, and is awkward for search and future note metadata.

### One singleton note per scope only

This sounds simple but becomes restrictive quickly. A notes dashboard is much more useful if it can hold multiple notes, drafts, and archives.

## Recommended Data Model

Add to [src/types.ts](/home/vas/sites/node/toomuchtodo/src/types.ts):

```ts
export type NoteScopeType = 'dashboard' | 'project' | 'area' | 'day';

export interface Note {
  id: string;
  title: string;
  body: string;
  scopeType: NoteScopeType;
  scopeRef: string | null;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}
```

Add to `AppStateData`:

```ts
notes: Note[];
```

Recommended semantics:

- `dashboard` notes: `scopeRef = null`
- `project` notes: `scopeRef = project.id`
- `area` notes: `scopeRef = area label`
- `day` notes: `scopeRef = YYYY-MM-DD`

Keep `title` required even if UI can auto-seed it. That makes the dashboard much easier to scan than anonymous markdown blobs.

## UI Strategy

### 1. Add a dedicated Notes dashboard

Add a new app view, likely `notes`, in [src/types.ts](/home/vas/sites/node/toomuchtodo/src/types.ts) and wire it into navigation in [src/app/App.tsx](/home/vas/sites/node/toomuchtodo/src/app/App.tsx).

Recommended dashboard sections:

- Pinned
- Recent
- By scope filter: All, Dashboard, Projects, Areas, Days
- Search field for title/body filtering

Recommended card fields:

- note title
- scope label
- updated timestamp
- markdown preview excerpt
- pin state

This should become the main management surface for notes rather than forcing users to hunt for notes inside each context.

### 2. Add scoped notes sections where the user already works

#### Project view

When the user opens a project task panel, show a compact notes section near the top of the panel or in a right-side block inside the existing content area handled through [src/features/tasks/TaskPanelWrapper.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskPanelWrapper.tsx).

Recommended initial behavior:

- show the most recent 1 to 3 project notes
- include `New project note`
- include `Open all notes for this project`

Do not force the whole project panel to become a full notes editor.

#### Area view

Because areas are currently strings, area-scoped notes should be exposed in the same panel that renders area-filtered tasks.

Recommended behavior:

- if an area is selected, show `Area Notes` above the task list header or immediately below it
- include one-click create
- include a shortcut to filtered notes dashboard

This gives area notes value without first needing a new `Area` table.

#### Day view

The day view already has a strong identity in [src/features/tasks/TaskListView.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskListView.tsx) and is fed by `selectedPlannerDate` in [src/app/App.tsx](/home/vas/sites/node/toomuchtodo/src/app/App.tsx).

Recommended behavior:

- add a `Day Notes` block at the top of the day panel, above morning/afternoon/evening groupings
- use the current date key as the note scope ref
- allow quick capture from planner day cells later, but do not make planner cards carry full editors in MVP

### 3. Reuse existing markdown UI primitives

Use [src/components/MarkdownEditor.tsx](/home/vas/sites/node/toomuchtodo/src/components/MarkdownEditor.tsx) as the base rather than building a second notes editor. It already matches the app's visual style and markdown capabilities.

Recommended follow-up improvement:

- factor a higher-level `NoteEditorCard` wrapper around `MarkdownEditor` once project/day/area notes exist

That prevents duplicating title, pin, delete, preview toggle, and metadata controls.

## Store and State Plan

Extend [src/store/useAppStore.ts](/home/vas/sites/node/toomuchtodo/src/store/useAppStore.ts) with note operations:

- `addNote(input)`
- `updateNote(id, updates)`
- `deleteNote(id)`
- `toggleNotePinned(id)`

Recommended helper selectors:

- `getNotesByScope(scopeType, scopeRef)`
- `getRecentNotes(limit)`
- `searchNotes(query)`

Implementation guidance:

- keep note CRUD in the same `setSharedState` transaction style as tasks and projects
- normalize missing title/body values in the same way tasks/projects are normalized today
- update `updatedAt` on any content or metadata mutation
- use soft-delete fields for sync compatibility, even if local UI still filters them out

## Local Persistence and Migration Plan

Current local schema version is `2` in [src/store/storage/migrations.ts](/home/vas/sites/node/toomuchtodo/src/store/storage/migrations.ts).

Recommended migration:

- bump local schema to `3`
- add `notes: []` to default app state
- migrate older envelopes by injecting empty `notes`

This is straightforward because notes are additive and do not require reshaping existing tasks or projects.

## Cloud Sync Plan

This is the most important architectural consequence of adding notes.

### Frontend sync changes

Update:

- [src/types.ts](/home/vas/sites/node/toomuchtodo/src/types.ts)
- [src/lib/sync/operations.ts](/home/vas/sites/node/toomuchtodo/src/lib/sync/operations.ts)

Add a new sync entity:

```ts
entity: 'task' | 'project' | 'note' | 'settings'
```

Add note diffing in `buildSyncOperations` using the same record-level comparison approach already used for tasks and projects.

### Worker schema changes

Add a new `notes` table in a new migration after [worker/migrations/0002_schema_defaults.sql](/home/vas/sites/node/toomuchtodo/worker/migrations/0002_schema_defaults.sql).

Recommended columns:

- `id TEXT PRIMARY KEY`
- `user_id TEXT NOT NULL`
- `title TEXT NOT NULL`
- `body TEXT NOT NULL`
- `scope_type TEXT NOT NULL`
- `scope_ref TEXT`
- `pinned INTEGER NOT NULL`
- `created_at INTEGER NOT NULL`
- `updated_at INTEGER NOT NULL`
- `deleted_at INTEGER`
- `version INTEGER NOT NULL DEFAULT 1`

Recommended indexes:

- `(user_id, updated_at)`
- `(user_id, deleted_at)`
- `(user_id, scope_type, scope_ref)`

### Worker route changes

Update [worker/src/routes/sync.ts](/home/vas/sites/node/toomuchtodo/worker/src/routes/sync.ts) to:

- upsert note rows in `pushOne`
- include notes in `readSnapshot`
- emit note changes in `pull`

## Search Integration Plan

The app already has search infrastructure in [src/lib/taskSearch.ts](/home/vas/sites/node/toomuchtodo/src/lib/taskSearch.ts) and [src/features/search/SearchView.tsx](/home/vas/sites/node/toomuchtodo/src/features/search/SearchView.tsx).

Recommended approach:

- keep task search intact
- add note search alongside it rather than merging notes into task result cards
- in MVP, the main notes dashboard gets its own local search field
- in phase 2, global app search can include note hits with a distinct result style

This keeps the initial delivery smaller while still producing a coherent notes product.

## Recommended Rollout

### Phase 1: Data model + local-only notes MVP

- add `Note` type and `notes` state collection
- add local CRUD in store
- add notes dashboard view
- add project/day/area scoped note sections with create and edit
- reuse `MarkdownEditor`

This gets the feature usable quickly without touching sync yet.

### Phase 2: Sync + migrations

- add schema v3 locally
- add D1 `notes` table
- extend sync protocol and snapshot
- verify bootstrap/push/pull for notes

### Phase 3: Search + polish

- add note filtering in dashboard
- add command palette shortcuts for note creation/opening
- add note preview excerpts and pinning UX
- optionally add backlinks from tasks/projects later

## Recommended UX Defaults

- allow multiple notes per scope, not just one
- auto-create untitled notes as `Untitled note` or a scope-aware variant
- sort by `pinned DESC, updatedAt DESC`
- show scope chips on note cards
- keep markdown body in preview/edit toggle flow similar to task notes

## Risks and Mitigations

### Risk: area notes are keyed by freeform strings

Because areas are currently strings, renaming an area later would strand scoped notes unless area names are normalized.

Mitigation:

- treat current area labels as stable for MVP
- if area management becomes editable later, add a first-class `Area` model and migrate note `scopeRef`

### Risk: day notes need stable date keys

This is already mostly solved because the app consistently uses `YYYY-MM-DD` date strings via the planner/day flow in [src/app/App.tsx](/home/vas/sites/node/toomuchtodo/src/app/App.tsx).

### Risk: sync payload volume grows

Mitigation:

- note records are still coarse-grained and append cleanly to the existing op model
- markdown bodies are acceptable at current scale
- if large-note performance becomes an issue, add field-level compression later, not in MVP

## Open Decisions

These should be decided before implementation starts:

1. Should the sidebar get a dedicated `Notes` entry immediately, or should notes first launch behind project/day context entry points plus command palette access?
2. Should the notes dashboard support note creation for all scopes from one `New note` button, or should scoped notes only be created from the relevant project/day/area context in MVP?
3. Should global app search include note hits in the first release, or stay notes-dashboard-only until the base notes UX settles?

## Final Recommendation

The best path is to introduce notes as a first-class entity.

Do not embed notes into projects or settings as one-off fields. That approach looks smaller initially, but it creates a fragmented data model and makes the dashboard, sync, and future search materially worse.

If the goal is a durable notes capability that feels native in projects, areas, and day planning, a unified `Note` entity with scoped attachments is the right architecture.