# Daily Goals Plugin Plan

## Goal

Add a daily goals section to the single-day task list view that behaves like an optional feature:

- visible in `day` views, above the task list
- scoped to a specific calendar day
- lightweight enough to feel native to the app
- structured so it can be toggled on or off without scattering feature checks everywhere
- compatible with the app's existing local-first and sync architecture

## Date

- Prepared: 2026-03-13

## Implementation Progress

### 2026-03-13 - Phases 1 through 4 implemented

- Added a first-class `DayGoal` entity and `dayGoals` top-level collection in [src/types.ts](/home/vas/sites/node/toomuchtodo/src/types.ts).
- Added a persisted `dailyGoalsEnabled` settings flag and schema v4 migration in:
  - [src/store/storage/migrations.ts](/home/vas/sites/node/toomuchtodo/src/store/storage/migrations.ts)
  - [src/store/storage/localDriver.ts](/home/vas/sites/node/toomuchtodo/src/store/storage/localDriver.ts)
- Added local store CRUD, reordering, and selectors in [src/store/useAppStore.ts](/home/vas/sites/node/toomuchtodo/src/store/useAppStore.ts).
- Implemented the feature module under:
  - [src/features/daily-goals/DailyGoalsSection.tsx](/home/vas/sites/node/toomuchtodo/src/features/daily-goals/DailyGoalsSection.tsx)
  - [src/features/daily-goals/DailyGoalCard.tsx](/home/vas/sites/node/toomuchtodo/src/features/daily-goals/DailyGoalCard.tsx)
  - [src/features/daily-goals/dayGoalsSelectors.ts](/home/vas/sites/node/toomuchtodo/src/features/daily-goals/dayGoalsSelectors.ts)
  - [src/features/daily-goals/dailyGoalsRegistry.ts](/home/vas/sites/node/toomuchtodo/src/features/daily-goals/dailyGoalsRegistry.ts)
- Wired the section into day and today panels from [src/features/tasks/TaskPanelWrapper.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskPanelWrapper.tsx).
- Added feature discovery and toggles in:
  - [src/app/App.tsx](/home/vas/sites/node/toomuchtodo/src/app/App.tsx)
  - [src/features/settings/SettingsView.tsx](/home/vas/sites/node/toomuchtodo/src/features/settings/SettingsView.tsx)
- Implemented full sync and D1 support in:
  - [src/lib/sync/operations.ts](/home/vas/sites/node/toomuchtodo/src/lib/sync/operations.ts)
  - [src/lib/sync/client.ts](/home/vas/sites/node/toomuchtodo/src/lib/sync/client.ts)
  - [src/lib/sync/engine.ts](/home/vas/sites/node/toomuchtodo/src/lib/sync/engine.ts)
  - [worker/src/types.ts](/home/vas/sites/node/toomuchtodo/worker/src/types.ts)
  - [worker/src/routes/sync.ts](/home/vas/sites/node/toomuchtodo/worker/src/routes/sync.ts)
  - [worker/src/db/schema.ts](/home/vas/sites/node/toomuchtodo/worker/src/db/schema.ts)
  - [worker/migrations/0007_day_goals_table.sql](/home/vas/sites/node/toomuchtodo/worker/migrations/0007_day_goals_table.sql)

### Implementation nuances

- The shipped UI supports up to three active goals per day, inline editing, task linking, completion toggling, archiving, deletion, and left-right priority reordering.
- The feature is hidden, not destructive, when disabled. Existing goal data remains stored locally and in sync.
- Day goals render from `TaskPanelWrapper`, not `TaskListView`, which keeps task rendering and day-surface modules separate.
- The sync worker was made schema-aware for bootstrap snapshots so older databases without the `day_goals` table still work during legacy-schema tests.

### Verification

- `pnpm build`
- `pnpm test`

## Current Baseline

The current app already has the right primitives for a feature like this, but not a true plugin system.

- Day screens are derived from scheduled tasks with `dueDate` and optional `dayPart`, not from a first-class `Day` record, in [src/features/tasks/TaskPanelWrapper.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskPanelWrapper.tsx) and [src/features/tasks/TaskListView.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskListView.tsx).
- App data is stored as one local-first state object with first-class entity arrays such as `tasks`, `projects`, and `notes` in [src/types.ts](/home/vas/sites/node/toomuchtodo/src/types.ts) and [src/store/useAppStore.ts](/home/vas/sites/node/toomuchtodo/src/store/useAppStore.ts).
- Optional UI behavior is typically controlled by `settings` flags, for example `groupDayViewByPart`, in [src/types.ts](/home/vas/sites/node/toomuchtodo/src/types.ts), [src/store/useAppStore.ts](/home/vas/sites/node/toomuchtodo/src/store/useAppStore.ts), and [src/app/App.tsx](/home/vas/sites/node/toomuchtodo/src/app/App.tsx).
- Content-like data is promoted to first-class entities when it needs its own lifecycle. Notes are the strongest recent example:
  - entity type in [src/types.ts](/home/vas/sites/node/toomuchtodo/src/types.ts)
  - store CRUD in [src/store/useAppStore.ts](/home/vas/sites/node/toomuchtodo/src/store/useAppStore.ts)
  - sync diffs in [src/lib/sync/operations.ts](/home/vas/sites/node/toomuchtodo/src/lib/sync/operations.ts)
  - worker sync support in [worker/src/routes/sync.ts](/home/vas/sites/node/toomuchtodo/worker/src/routes/sync.ts)
- There is no runtime module loader or extension registry today. Calling this a "plugin" only makes sense if it is implemented as a feature module plus feature flag, not as an installable plugin platform.

## Recommendation

Use a first-class `DayGoal` entity plus a small feature registry and a persisted settings flag.

This is the cleanest fit for the current codebase.

Recommended shape:

- `dayGoals` becomes a top-level collection in app state
- `dailyGoalsEnabled` becomes a persisted setting
- the day panel asks a small feature registry whether the daily-goals module is enabled and should render
- the actual feature UI and business logic live under a dedicated feature folder, not inside generic task-list code

This gives you three useful properties:

1. The data model is explicit and syncable.
2. The feature can be hidden globally without deleting user data.
3. The implementation remains modular without overbuilding a generic plugin framework the app does not need yet.

## What "Plugin" Should Mean Here

Do not start with a real plugin system.

That would add substantial complexity with very little return because the app currently has:

- one shared React bundle
- one shared app store
- one sync protocol with hard-coded entity types
- no dynamic loading boundary

For this codebase, "toggleable plugin" should mean:

- a self-contained feature module under `src/features/daily-goals`
- one registration object describing:
  - feature id
  - settings key
  - optional render hook for supported surfaces
- one persisted on/off flag in settings
- one top-level check in the day panel to decide whether the module renders

That is enough modularity for now. If a second or third comparable feature appears later, you can generalize the registry.

## Why Not Store Goals Inside Existing Models

### Option 1: Encode goals as ordinary tasks

Do not use this as the primary model.

Problems:

- Goals are conceptually different from executable task rows.
- You would need conventions like tags or fake statuses to separate them from normal tasks.
- Completion semantics are different: a goal is a highlighted outcome, not just another scheduled checkbox.
- The day list would become harder to query and reason about.

Using tasks only as references from goals is fine. Using tasks as the goals data model is not.

### Option 2: Store goals in `settings.dayGoalsByDate`

Do not do this.

Problems:

- `settings` is currently for preferences, not user-authored content.
- Sync diffs would become coarse because one settings record would carry both preferences and growing per-day content.
- Deletion, history, and future metadata become awkward quickly.

### Option 3: Embed goals in day notes

This is tempting because day notes already exist, but it is the wrong abstraction.

Problems:

- Notes are freeform documents, not structured UI cards.
- You would lose ordering, per-goal completion, optional task links, and future analytics.
- The UI would become a parser problem instead of a data-model problem.

## Recommended Data Model

Add a new entity in [src/types.ts](/home/vas/sites/node/toomuchtodo/src/types.ts):

```ts
export interface DayGoal {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  linkedTaskId: string | null;
  position: number;
  completedAt: number | null;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  syncVersion?: number | null;
}
```

Recommended semantics:

- `date` is the day scope key used elsewhere in the app.
- `position` controls the card order inside a day.
- `linkedTaskId` is optional. It lets a goal point at a primary task without forcing goals to be tasks.
- `completedAt` is separate from task completion so a goal can be marked complete independently.
- `archivedAt` allows later support for showing completed/retired goals without deleting them.

Also add to `AppStateData`:

```ts
dayGoals: DayGoal[];
```

And to `AppSettings`:

```ts
dailyGoalsEnabled: boolean;
```

Default:

```ts
dailyGoalsEnabled: false;
```

## Why a Dedicated Entity Is Better

It fits the app's architecture better than any shortcut:

- It matches the note pattern: content gets its own collection.
- It keeps day goals queryable by date without coupling them to task filtering.
- It can be synced incrementally with the existing `entity/action/recordId` protocol.
- It keeps the task model clean.

It also leaves room for sensible future additions:

- limit to 3 highlighted goals
- per-goal color or badge
- progress indicators based on linked tasks
- carry-forward suggestions from yesterday

## Suggested Feature Module Structure

Recommended folder layout:

```txt
src/features/daily-goals/
  DailyGoalsSection.tsx
  DailyGoalCard.tsx
  dailyGoalsRegistry.ts
  dayGoalsSelectors.ts
```

Recommended responsibility split:

- `DailyGoalsSection.tsx`
  - receives `dateStr`, goals, tasks, and store callbacks
  - renders the section only when the feature is enabled
- `DailyGoalCard.tsx`
  - owns one goal card's display and inline edit interactions
- `dayGoalsSelectors.ts`
  - date-scoped filtering, ordering, linked-task lookup, and derived completion helpers
- `dailyGoalsRegistry.ts`
  - minimal registration object for the feature surface

Example registry shape:

```ts
export interface AppFeatureModule {
  id: string;
  settingsKey: keyof AppSettings;
  supportsSurface: (surface: 'day-panel' | 'planner-cell') => boolean;
}

export const dailyGoalsFeature: AppFeatureModule = {
  id: 'daily-goals',
  settingsKey: 'dailyGoalsEnabled',
  supportsSurface: (surface) => surface === 'day-panel',
};
```

This should stay intentionally small. The purpose is to keep feature wiring contained, not to invent an extension SDK.

## UI Placement Recommendation

Render the daily goals section in the day panel wrapper, not deep inside the generic task-list renderer.

Recommended insertion point:

- inside [src/features/tasks/TaskPanelWrapper.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskPanelWrapper.tsx)
- only when `panel.view === 'day'` or `panel.view === 'today'`
- above `TaskListView`

Why this is the right boundary:

- The day scope is already resolved in `TaskPanelWrapper`.
- Notes links and other scoped top-of-panel blocks are already handled there.
- `TaskListView` should stay focused on rendering tasks and task-grouping behavior, not unrelated day-surface modules.

The section should receive:

- the active `dateStr`
- the tasks for optional goal linking
- goal CRUD and reorder callbacks
- the settings flag

## Suggested UX Shape

Start with a constrained MVP:

- max 3 active goals per day
- each goal shows:
  - small ordinal label like `Goal 1`
  - title
  - optional linked-task hint
  - completion toggle
- allow:
  - add goal
  - edit title inline
  - reorder left/right
  - archive or delete

Important product choice:

- do not auto-create goals from starred tasks
- do not auto-sync goal completion from linked task completion in v1

Reason:

- users need a stable highlighted-outcomes layer, not a fragile derived view
- one-way derived behavior will create confusing edge cases quickly

If you want lightweight coupling, show linked task progress as a visual hint only.

## Store and State Plan

Follow the same pattern already used for tasks, projects, and notes in [src/store/useAppStore.ts](/home/vas/sites/node/toomuchtodo/src/store/useAppStore.ts).

Add:

- `normalizeDayGoal`
- `addDayGoal(input)`
- `updateDayGoal(id, updates)`
- `deleteDayGoal(id)`
- `toggleDayGoalComplete(id)`
- `reorderDayGoals(date, sourceId, targetId)`
- `archiveDayGoal(id)`
- `toggleDailyGoalsEnabled()`

Recommended selector helpers:

- `getDayGoals(dateStr)`
- `getActiveDayGoals(dateStr)`
- `getLinkedTaskForGoal(goal, tasksById)`

Implementation detail:

- keep `dayGoals` as a flat array like tasks and notes
- derive day-scoped ordered subsets with selectors
- preserve the app's current "flat collection + derived view" design

## Persistence and Migration Plan

The app currently persists one local envelope and uses schema migrations in [src/store/storage/migrations.ts](/home/vas/sites/node/toomuchtodo/src/store/storage/migrations.ts).

Recommended migration:

- bump `APP_SCHEMA_VERSION` from `3` to `4`
- add `dayGoals: []` to default state
- add `dailyGoalsEnabled: false` to default settings
- add a `migrateV3toV4` step

That migration should:

- initialize missing `dayGoals` to `[]`
- merge `dailyGoalsEnabled` into settings defaults
- leave all existing tasks, notes, and projects untouched

Even though the app sometimes relies on backward-compatible normalization, this feature adds a new top-level collection and a new preference. A real schema bump is cleaner here.

## Sync Plan

If cloud sync matters for this feature, treat day goals as a first-class sync entity from the start.

Add `dayGoal` to the sync entity union in:

- [src/types.ts](/home/vas/sites/node/toomuchtodo/src/types.ts)
- [worker/src/types.ts](/home/vas/sites/node/toomuchtodo/worker/src/types.ts)

Extend diff generation in [src/lib/sync/operations.ts](/home/vas/sites/node/toomuchtodo/src/lib/sync/operations.ts):

- compare `prev.dayGoals` vs `next.dayGoals`
- emit `upsert` and `delete` operations

Extend worker storage and sync handling in:

- [worker/src/routes/sync.ts](/home/vas/sites/node/toomuchtodo/worker/src/routes/sync.ts)
- new worker migration for a `day_goals` table

Recommended table fields:

- `id`
- `user_id`
- `date`
- `title`
- `linked_task_id`
- `position`
- `completed_at`
- `archived_at`
- `created_at`
- `updated_at`
- `deleted_at`
- `version`

Important note:

- do not try to fold day goals into the existing `settings` sync record just to avoid worker changes
- that shortcut will create a worse architecture than the extra sync work costs

## Task Linking Strategy

Support optional task links, but do not make them required.

Recommended behavior:

- a goal may reference one primary task via `linkedTaskId`
- if the task is deleted, the goal remains and the link is cleared on next edit or during a selector fallback
- the goal card may offer `Open task`
- linked task completion can tint the goal card, but should not force goal completion

Why one link first:

- it keeps UI and schema simple
- most highlighted goals map to one anchor task or project deliverable
- multiple links can be added later via a join table or `linkedTaskIds` if the feature proves valuable

## Rollout Plan

### Phase 1: Data and local feature toggle

- add `DayGoal` type and `dayGoals` state collection
- add `dailyGoalsEnabled` setting
- add store CRUD and selector helpers
- add schema v4 migration

Success criteria:

- goals persist locally
- feature can be enabled or disabled without data loss

### Phase 2: Day panel UI

- create `src/features/daily-goals` components
- render the section above `TaskListView` in day contexts
- support create, edit, complete, delete, and reorder

Success criteria:

- day view shows goal cards only when enabled
- normal task list behavior remains unchanged when disabled

### Phase 3: Settings integration

- expose a toggle in settings or the day-view toolbar
- optionally add a quick per-view button similar to `groupDayViewByPart`

Success criteria:

- users can discover and control the feature without hidden flags

### Phase 4: Sync support

- add sync entity, worker table, and migrations
- add client merge and worker pull/push support

Success criteria:

- goals round-trip across devices like notes do

### Phase 5: Follow-up enhancements

- carry forward incomplete goals to the next day
- linked-task progress hints
- planner-cell summary chip
- optional daily-goals note integration

## Risks and Tradeoffs

### Risk: overbuilding a generic plugin system

Avoid this.

There is not enough feature surface in the app yet to justify:

- dynamic feature loading
- plugin manifests
- injectable reducers
- runtime extension APIs

Build a narrow feature registry instead.

### Risk: placing daily goals inside `TaskListView`

This would blur concerns.

`TaskListView` already handles:

- list vs outline rendering
- day-part grouping
- scheduled grouping
- selection and marquee interactions

Adding daily-goals concerns there will make the core task renderer harder to maintain.

### Risk: using tasks as the data source

This will look simpler initially, but it will collapse goals into ordinary scheduling data and make the UI harder to evolve.

## Concrete File Impact

Likely implementation touchpoints:

- [src/types.ts](/home/vas/sites/node/toomuchtodo/src/types.ts)
- [src/store/useAppStore.ts](/home/vas/sites/node/toomuchtodo/src/store/useAppStore.ts)
- [src/store/storage/migrations.ts](/home/vas/sites/node/toomuchtodo/src/store/storage/migrations.ts)
- [src/features/tasks/TaskPanelWrapper.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskPanelWrapper.tsx)
- [src/app/App.tsx](/home/vas/sites/node/toomuchtodo/src/app/App.tsx)
- [src/lib/sync/operations.ts](/home/vas/sites/node/toomuchtodo/src/lib/sync/operations.ts)
- [worker/src/types.ts](/home/vas/sites/node/toomuchtodo/worker/src/types.ts)
- [worker/src/routes/sync.ts](/home/vas/sites/node/toomuchtodo/worker/src/routes/sync.ts)
- `worker/migrations/<next>_day_goals.sql`

New files:

- [src/features/daily-goals/DailyGoalsSection.tsx](/home/vas/sites/node/toomuchtodo/src/features/daily-goals/DailyGoalsSection.tsx)
- [src/features/daily-goals/DailyGoalCard.tsx](/home/vas/sites/node/toomuchtodo/src/features/daily-goals/DailyGoalCard.tsx)
- [src/features/daily-goals/dayGoalsSelectors.ts](/home/vas/sites/node/toomuchtodo/src/features/daily-goals/dayGoalsSelectors.ts)
- [src/features/daily-goals/dailyGoalsRegistry.ts](/home/vas/sites/node/toomuchtodo/src/features/daily-goals/dailyGoalsRegistry.ts)

## Final Recommendation

Build daily goals as a first-class day-scoped entity with a feature flag, not as fake tasks and not as a generic plugin platform.

If you want the shortest path that still stays clean:

1. add `DayGoal` + `dailyGoalsEnabled`
2. render the section from `TaskPanelWrapper`
3. keep the feature module isolated under `src/features/daily-goals`
4. add sync only after the local UX proves worthwhile

That gives you a structure that is genuinely toggleable, consistent with the rest of the codebase, and still small enough to ship without architecture debt.
