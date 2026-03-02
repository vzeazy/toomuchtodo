# JSON Import + LLM Plan Workflow Report

## Goal

Design a clean, reliable way for this app to:

- import one or many projects/task lists from JSON
- support LLM-generated plans from a template
- support relative date planning (for example, "start in 10 days")
- update, delete, or fully strip imported plans later
- export plan-progress context for an LLM to suggest timeline adjustments
- keep a meaningful change log of task updates/completions

---

## Progress log

### 2026-03-02 - Scoped roundtrip implementation completed

- Added new scoped task-list exchange schema/types:
  - `TaskListScope`
  - `TaskListImportMode`
  - `TaskListExchange` (+ project/task payload types)
- Implemented task-list exchange helpers in `src/lib/taskListExchange.ts`:
  - scoped JSON payload export for Inbox/Project
  - JSON shape guard
  - scoped progress prompt generator (LLM handoff)
  - simple markdown export renderer
- Added scoped import engine in store (`importTaskListData`) with:
  - `append` mode
  - `upsert` mode
  - `replace-list` mode
- Added Settings UI for scoped roundtrip:
  - scope selector (Inbox or Project)
  - import mode selector
  - export list JSON
  - import list JSON (with confirmation)
  - export list markdown
  - copy progress prompt
- Wired new Settings actions in app shell (`src/app/App.tsx`).
- Verified with production build: `npm run build` (pass).

Nuances:

- This phase intentionally implements **Markdown export only** (not Markdown import), matching current scoped plan boundaries.
- Scoped import currently enforces scope consistency:
  - Inbox imports are normalized to `status: inbox`
  - Project imports are normalized to the selected project id
- This gives predictable behavior for list roundtrips while avoiding higher-risk parser/import ambiguity.

### 2026-03-02 - UX refinement + missing prompt flow completed

- Moved Agent Theme Builder into a collapsible advanced section under Themes.
- Upgraded Task List Roundtrip UI:
  - larger quick-start button cards with concise explanations
  - project selection + direction/nuance input for generation
  - quick actions focused on:
    - copy template prompt to clipboard
    - import project JSON
- Added missing task-list generator template prompt flow:
  - new `getTaskListGenerationPrompt(...)` helper in `src/lib/taskListExchange.ts`
  - prompt explicitly instructs LLM to return strict `too-much-to-do.task-list` JSON using app-supported task fields
- Moved secondary actions into collapsible advanced area:
  - scoped export JSON
  - scoped import JSON with mode control
  - markdown export
  - progress prompt copy

Nuances:

- Quick import intentionally normalizes imported payload to the selected project scope for predictable behavior.
- Advanced import still supports Inbox/project scope controls and all import modes.
- Build verified after refinements: `npm run build` (pass).

### 2026-03-02 - Drag/drop + off-canvas task detail refinement completed

- Implemented off-canvas subtask drag behavior in `TaskModal`:
  - subtasks are now draggable
  - between-subtask drop zones support reorder inside the parent task
  - added detach/drop targets to convert a subtask into top-level task flow
  - added project/area drop-aware zones in the bottom controls section for seamless "drag out of subtasks" conversion
- Refined drag placement hints across list views:
  - `TaskRow` and `OutlineTaskRow` now use subtler insertion/nesting hints (minimal bars/markers instead of heavy glow styles)
  - planner drop line styling softened for cleaner placement cues
  - planner day/project columns now show lightweight hover-state hints while dragging
- Updated off-canvas detail layout:
  - notes now support dynamic preview with auto-collapse on long content plus simple expand/collapse
  - notes editing remains one click away
  - subtasks remain directly below notes
  - project/area/parent/due/tags controls are grouped at the bottom section of the panel

Nuances:

- Off-canvas reorder currently targets sibling ordering under the same parent task for predictability.
- Drag-to-project/area in off-canvas detaches the dropped subtask (sets parent to null) and applies scope updates without requiring extra dialogs.
- Build verified after refinement pass: `npm run build` (pass).

---

## What exists today (codebase findings)

### 1) Data model and persistence

- `src/types.ts` defines:
  - `Task` with fields including `status`, `projectId`, `dueDate`, `parentId`, `createdAt`, `tags`
  - `Project` with optional nesting via `parentId`
  - app state container `AppStateData`
  - export envelope `AppDataExport`
- `src/store/useAppStore.ts` persists entire app state in localStorage (`too_much_to_do_state_v1`).
- `normalizeTask` and `normalizeProject` perform lightweight coercion/sanitization during load/import.

### 2) Import/export support already exists (but is whole-app replace)

- Export:
  - `createExportPayload` in `src/store/useAppStore.ts`
  - wired in settings and command palette via `downloadJson(...)` in `src/app/App.tsx`
- Import:
  - settings file picker in `src/features/settings/SettingsView.tsx`
  - guard `isAppExport(...)` in `src/app/App.tsx`
  - `importAppData(...)` in `src/store/useAppStore.ts` replaces full app state

### 3) Task lifecycle behavior

- Completion is toggled via `toggleComplete` (`completed` <-> `scheduled|next`) in `src/store/useAppStore.ts`.
- Deletion is hard delete (`deleteTask`) not soft delete/archive.
- `TaskStatus` includes `'deleted'`, and `AppView` includes `'trash'`, but current UI flow does not actively use a trash lifecycle.
- There is no task change history/audit table/list in app state.

### 4) Good foundation already in place

- Hierarchy support (`parentId`, `collapsed`) and tree helpers exist.
- JSON portability already exists at full-state level.
- Theme workflow already demonstrates "LLM prompt + paste JSON + validate + apply" pattern.

---

## Gap analysis vs your requested workflow

### Missing today

1. **Plan-level identity**
   - Tasks/projects have no `sourcePlanId` or import origin metadata.
   - Cannot cleanly remove "everything imported from Plan X".

2. **Partial import modes**
   - Current import replaces whole state.
   - No append/merge/upsert modes for one or many plan bundles.

3. **Relative date resolution**
   - No first-class fields like `offsetDays`, `anchor`, or `baselineStartDate`.
   - Only concrete `dueDate` values are supported.

4. **LLM planning contract**
   - No plan-specific JSON schema/template yet.
   - No purpose-built generator prompt for "build me an execution plan".

5. **Progress snapshot export for LLM**
   - No feature that emits a compact context payload of completion %, slips, blockers, and changed dates.

6. **Change log / audit trail**
   - No event history for updates, status transitions, or due-date changes.

---

## Recommended architecture

## A) Introduce a separate importable "Plan Bundle" schema (do not overload full-app export)

Keep `AppDataExport` for backup/restore. Add a second schema for operational planning:

```json
{
  "schema": "too-much-to-do.plan-bundle",
  "version": 1,
  "bundleId": "bundle-launch-q3",
  "bundleName": "Q3 Product Launch",
  "createdBy": "llm|human",
  "generatedAt": "2026-03-01T00:00:00.000Z",
  "baseline": {
    "mode": "relative",
    "anchor": "import_date",
    "startDate": null
  },
  "projects": [],
  "tasks": [],
  "metadata": {}
}
```

### Task payload for plan bundles

Include both relative and resolved date support:

```json
{
  "id": "task-market-research",
  "title": "Run customer interviews",
  "description": "",
  "projectRef": "proj-discovery",
  "parentRef": null,
  "status": "next",
  "tags": ["research"],
  "schedule": {
    "relativeOffsetDays": 5,
    "durationDays": 3,
    "hardDate": null
  },
  "priority": "p1",
  "dependsOn": []
}
```

On import, compute concrete app `dueDate` from baseline if relative scheduling is used.

## B) Add plan provenance fields to app entities

Extend persisted model:

- `Task.sourcePlanId?: string | null`
- `Task.sourceExternalId?: string | null` (task id from imported bundle)
- `Project.sourcePlanId?: string | null`
- new `PlanRecord` collection at state level (import metadata)

This unlocks:

- delete all tasks/projects from a given imported plan
- update/upsert by stable external ids
- reporting by plan source

## C) Add explicit import modes

For plan bundle import:

1. **Append**: always create new internal ids, preserve links.
2. **Upsert by sourceExternalId+sourcePlanId**: update existing imported tasks.
3. **Replace plan**: remove previous entities from same plan, then import fresh.
4. **Preview + confirm** (recommended): show counts before applying.

## D) Add an event log (lightweight audit trail)

Add `taskEvents` state collection:

```ts
type TaskEventType =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'completed'
  | 'reopened'
  | 'due_date_changed'
  | 'deleted'
  | 'imported'
  | 'import_replaced';
```

Each event should include:

- `id`, `taskId`, `sourcePlanId`, `type`, `timestamp`
- optional `before` / `after` snapshots for key fields

Emit events from central store mutations (`updateTask`, `toggleComplete`, `deleteTask`, import actions), not from UI components.

## E) Add progress snapshot export for LLM replanning

Create `buildPlanProgressPrompt(planId)` that outputs:

- current baseline/anchor
- completion metrics (total, completed, overdue)
- slipped tasks (planned offset vs actual)
- changed due dates + status transitions
- blockers/dependencies still open

Then provide:

1. **Copy prompt** button
2. **Copy raw JSON context** button

This mirrors your existing successful theme-builder UX pattern.

---

## UX proposal

## Settings > Data > Plans

Add a dedicated "Plans" section:

- Import plan bundle (JSON file or pasted JSON)
- Import mode selector (Append / Upsert / Replace Plan)
- Relative start options:
  - start on import date
  - start on selected date
  - preserve hard dates only
- Preview summary before apply:
  - projects to add/update
  - tasks to add/update/delete
  - date resolution summary

## Plan management table

For each imported plan:

- Plan name, imported date, last updated
- progress percent and overdue count
- actions:
  - Export LLM progress prompt
  - Export plan snapshot JSON
  - Re-import update
  - Remove plan artifacts (strip all tasks/projects by `sourcePlanId`)

---

## Suggested implementation phases

## Phase 1 — Schema + store foundation

1. Extend types with `PlanBundle`, `PlanRecord`, provenance fields, `TaskEvent`.
2. Add state collections for plan records and task events.
3. Add migration-safe normalization defaults.
4. Keep current full-app import/export untouched.

## Phase 2 — Bundle parser + importer

1. Add JSON validation utility for plan bundles.
2. Add relative date resolver.
3. Implement append/upsert/replace import strategies.
4. Emit task events during import.

## Phase 3 — Plan management UI

1. Add Settings > Plans section.
2. Add import preview and mode selection.
3. Add per-plan actions (reimport/remove/export snapshot).

## Phase 4 — LLM loop integration

1. Add "Generate plan template prompt" helper.
2. Add "Export progress prompt" from imported plan records.
3. Add optional "Apply proposed changes JSON" pathway using same validator.

## Phase 5 — Hardening

1. Add validation edge-case handling (bad refs, cycles, duplicate IDs).
2. Add regression tests for importer and relative scheduling.
3. Add concise docs/example templates in `docs/`.

---

## Recommended JSON template for LLM generation (MVP)

Use this as the model contract you feed into an LLM:

```json
{
  "schema": "too-much-to-do.plan-bundle",
  "version": 1,
  "bundleId": "string",
  "bundleName": "string",
  "baseline": {
    "mode": "relative",
    "anchor": "import_date",
    "startDate": null
  },
  "projects": [
    { "id": "proj-1", "name": "Project Name", "parentId": null }
  ],
  "tasks": [
    {
      "id": "task-1",
      "title": "Task title",
      "description": "markdown allowed",
      "projectRef": "proj-1",
      "parentRef": null,
      "status": "next",
      "tags": [],
      "schedule": { "relativeOffsetDays": 0, "durationDays": 1, "hardDate": null },
      "dependsOn": []
    }
  ]
}
```

---

## Risks and mitigations

1. **ID collisions / duplicate imports**
   - Mitigation: provenance keys (`sourcePlanId`, `sourceExternalId`) + import mode semantics.

2. **Date drift confusion**
   - Mitigation: always store resolved date + relative metadata; show both in plan management UI.

3. **Accidental destructive replacement**
   - Mitigation: preview + explicit confirmation for Replace/Strip operations.

4. **Noisy event logs**
   - Mitigation: event compaction for repetitive edits and capped retention strategy.

---

## Concrete recommendation

The cleanest path is a **dual-schema strategy**:

- keep current full-state JSON import/export for backup portability
- add a dedicated **Plan Bundle** JSON format with provenance + relative schedule semantics

Then wire a new "Plans" management layer that supports import/update/strip and generates an LLM-ready progress prompt from tracked event history. This gives you the loop you described: **LLM generates plan -> app imports and tracks -> app exports progress context -> LLM suggests timeline updates -> app reapplies cleanly**.

---

## Scope update (2026-03-01)

Per latest direction, keep the hardest pieces out for now.

### In scope now

1. **Scoped task-list JSON round-trip (Inbox or single Project)**
   - Export selected list to LLM-friendly JSON.
   - Re-import with `append` / `upsert` / `replace-list` modes.
   - Keep preview + validation before apply.

2. **LLM progress prompt export for a scoped list**
   - Export concise status/progress context for that Inbox/Project list.
   - Use same provenance IDs to safely apply updated JSON.

3. **Simple Markdown export (one-way)**
   - Export Inbox/Project lists to readable `.md`.
   - Include title, status marker, due date, tags, and nesting.

### Explicitly out of scope for now

1. **Markdown/TaskPaper import**
   - Deferred due to parser ambiguity and higher error risk.
2. **Advanced dependency scheduling and auto-reflow logic**
   - Deferred until scoped JSON loop is stable.
3. **Complex event-log analytics UI**
   - Keep basic event capture only in this phase.

### Revised delivery order

1. Add scoped JSON exporter/importer for Inbox/Project lists.
2. Add LLM progress prompt export for scoped lists.
3. Add simple Markdown export for scoped lists.
4. Defer Markdown/TaskPaper import until later hardening phase.
