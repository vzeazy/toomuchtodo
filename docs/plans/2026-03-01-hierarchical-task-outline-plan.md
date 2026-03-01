# Hierarchical Task Outline Plan

## Goal

Add an alternate task-list presentation that feels like a Workflowy-style outline while keeping the current list view intact. Tasks need to support parent/child relationships, hierarchical ordering, seamless rendering in the existing main task list, and drag or keyboard-based restructuring.

## Progress Log

### 2026-03-01 - Phase 1 completed

- Extended the task model with `parentId` and `collapsed`.
- Extended persisted settings with a task-list mode preference so the outline toggle can persist.
- Updated task normalization and import compatibility so older saved/exported data defaults safely into the new hierarchy-capable model.
- Added shared tree utilities for:
  - descendant lookup
  - ancestor context expansion
  - visible tree flattening
  - subtree-safe move operations
  - cycle prevention during reparenting

Nuance:

- The underlying store remains a flat ordered task array. Hierarchy is represented by `parentId` and derived tree selectors rather than nested child arrays, which keeps filtering and persistence manageable.

### 2026-03-01 - Phases 2 through 5 completed

- Added a persisted `list` / `outline` toggle to the task list header.
- Kept the existing flat list view intact while adding child-count signals so parent tasks remain understandable outside outline mode.
- Added a dedicated outline row presentation with:
  - indentation by depth
  - collapse and expand controls
  - context ancestor badges for filtered views
  - keyboard guidance for hierarchy operations
- Added hierarchy mutations and interactions for:
  - move before sibling
  - move after sibling
  - indent under the previous visible row
  - outdent to the parent level
  - collapse and expand branches
- Added keyboard support in the outline rows:
  - `Tab` to indent
  - `Shift+Tab` to outdent
  - `Alt+ArrowUp` to move up
  - `Alt+ArrowDown` to move down
- Added parent assignment in the task modal so hierarchy can also be edited from the existing details surface.
- Updated filtered outline rendering so matching tasks bring their ancestor chain into view for context.

Nuances:

- Outline movement is currently button and keyboard driven rather than drag-and-drop. The tree-safe movement semantics are in place, but the visual drop-target layer was intentionally deferred to keep the first hierarchy release coherent.
- Flat list drag reordering remains the simpler legacy behavior. Outline mode is the hierarchy-aware editing surface.
- Ancestor-context rendering in filtered views can surface a parent that does not itself match the active filter. That is intentional so nested matching tasks are not orphaned visually.

## Review Findings

### Current task model is flat

- [`src/types.ts`](/home/vas/sites/node/toomuchtodo/src/types.ts) defines `Task` as a flat record with no parent/child or ordering fields beyond global array position.
- [`src/store/useAppStore.ts`](/home/vas/sites/node/toomuchtodo/src/store/useAppStore.ts) stores tasks as a single ordered array and normalizes only flat task fields.

### Current reorder behavior cannot express hierarchy

- [`src/store/useAppStore.ts`](/home/vas/sites/node/toomuchtodo/src/store/useAppStore.ts) only supports `reorderTasks(sourceId, targetId)`, which moves one task before another in the global array.
- [`src/features/tasks/TaskRow.tsx`](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskRow.tsx) drag/drop only emits a flat reorder action. There is no drop intent for `before`, `after`, or `nest under`.

### Current list rendering is row-based, not tree-based

- [`src/features/tasks/TaskListView.tsx`](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskListView.tsx) renders a plain `tasks.map(...)`.
- [`src/features/tasks/TaskRow.tsx`](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskRow.tsx) has no indentation, disclosure state, child count, ancestry awareness, or subtree collapse behavior.

### Add flows are also flat

- [`src/components/GhostItem.tsx`](/home/vas/sites/node/toomuchtodo/src/components/GhostItem.tsx) always creates a sibling task in the current list context.
- [`src/features/tasks/TaskModal.tsx`](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskModal.tsx) has no way to assign or inspect parentage.

### Filtering and views will need explicit tree rules

- Current views in [`src/app/App.tsx`](/home/vas/sites/node/toomuchtodo/src/app/App.tsx) filter tasks by status, project, area, or due date, then hand a flat array to the list.
- Once hierarchy exists, the app must decide whether filtered views show:
  - only direct matches
  - matches plus visible ancestors for context
  - matches plus descendants

## Recommended Product Shape

### View modes

- Keep the current list as the default `list` mode.
- Add an alternate `outline` mode in task list screens, not in planner columns.
- The toggle should live in the task list header and preserve the current screen context such as `Inbox`, `Scheduled`, project, area, or single day.

### Hierarchy behavior

- A task may optionally have a parent task.
- Children inherit visual placement from the tree, not from a separate per-parent array.
- Reordering must support:
  - move before a sibling
  - move after a sibling
  - indent under previous visible sibling
  - outdent to parent level
- Completed state should remain per task. Do not auto-complete parents from children in the first version.

### Seamless main-list behavior

- The existing list view should remain usable for users who do not want outlining.
- Parent tasks should still appear as ordinary tasks in the main list, with subtle indicators when they have children.
- Notes, tags, projects, due dates, starring, and modal editing should continue to work without separate task types.

## Data Model Changes

### Task fields to add

Recommended additions to `Task`:

```ts
parentId: string | null;
collapsed?: boolean;
```

Optional but useful if drag/drop semantics become more precise later:

```ts
orderKey?: string;
```

Recommendation:

- Start with `parentId` and derive visible order from the main task array.
- Do not introduce a complex normalized tree structure yet.
- Add `collapsed` only if you want outline folding in the first hierarchy release. I recommend yes.

### Why not a nested `children` array

- Nested children complicate filtering, persistence, drag/drop, and updates because every mutation becomes recursive.
- A flat store with `parentId` plus ordered task IDs works better with the current architecture and preserves compatibility with existing list screens.

## Rendering Strategy

### Build a derived visible tree

Introduce a selector layer that converts the filtered flat task set into:

- `visibleRows`
- `depth`
- `hasChildren`
- `isCollapsed`
- `ancestorIds`

Recommended helper location:

- `src/features/tasks/taskTree.ts`

Recommended helpers:

- `buildTaskTree(tasks)`
- `flattenVisibleTaskTree(tasks, collapsedState)`
- `getTaskDescendantIds(taskId, tasks)`
- `canReparentTask(taskId, candidateParentId)`

### Row behavior in outline mode

Each row should gain:

- left indentation by `depth`
- disclosure toggle when children exist
- a clearer drag handle
- keyboard affordances for indent/outdent and moving items

Useful first-pass keyboard bindings:

- `Tab`: indent under previous sibling when valid
- `Shift+Tab`: outdent one level
- `Mod+Shift+ArrowUp`: move up
- `Mod+Shift+ArrowDown`: move down

## Store and Mutation Changes

### New mutations needed

Add store actions for:

- `setTaskParent(taskId, parentId)`
- `indentTask(taskId)`
- `outdentTask(taskId)`
- `moveTaskBefore(taskId, targetId)`
- `moveTaskAfter(taskId, targetId)`
- `toggleTaskCollapsed(taskId)`

### Migration

Update task normalization in [`src/store/useAppStore.ts`](/home/vas/sites/node/toomuchtodo/src/store/useAppStore.ts) so older saved data defaults to:

```ts
parentId: null
collapsed: false
```

This can remain a soft migration inside `normalizeTask`; no storage-version bump is strictly required if you keep defaults backward-compatible. If you expect more hierarchy metadata soon, bumping the persisted version would still be cleaner.

## Filtering Rules

Recommended first-version rule:

- Filter tasks exactly as today.
- In `outline` mode, include any ancestor chain needed to render matching tasks in context.
- Do not automatically include all descendants of a matching parent unless the parent itself matches the filter.

Reason:

- This keeps filtered views useful without exploding the visible list.
- Users still understand where a matching task sits in the outline.

## UI Delivery Plan

### Phase 1: Data foundation

- Extend `Task` with `parentId` and `collapsed`.
- Update normalization, import/export, and initial-state compatibility.
- Add tree helpers and tests for ancestry, visible flattening, and invalid reparenting.

### Phase 2: Outline mode shell

- Add a `list` / `outline` toggle to [`src/features/tasks/TaskListView.tsx`](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskListView.tsx).
- Keep current list rows unchanged for `list`.
- Render a tree-aware row variant for `outline`.

### Phase 3: Hierarchy mutations

- Replace flat `reorderTasks` usage in outline mode with tree-aware move actions.
- Add indent/outdent controls and keyboard support.
- Add collapse/expand controls for parents.

### Phase 4: Seamless integration

- Show child-count or disclosure affordances in normal list rows.
- Add parent assignment controls in the task modal only if needed for recovery/editing, not as the primary interaction.
- Ensure project, area, due date, and day-view filters still behave predictably.

### Phase 5: Refinement

- Improve drag target previews so users can see whether they are dropping before, after, or into a task.
- Add multi-level keyboard navigation.
- Consider breadcrumb or ancestor chips in focused contexts like single-day view.

## Risks

- Tree filtering can become confusing if ancestors and descendants appear inconsistently.
- Drag/drop nesting is easy to make ambiguous without strong drop indicators.
- Reusing the current row expansion for notes may conflict with outline disclosure unless those controls are visually separated.
- Global array ordering plus `parentId` is workable, but it needs strict guardrails to prevent cycles and orphaned descendants.

## Recommendation

Implement this as a phased feature, not as a one-pass UI tweak. The correct foundation is a flat task store with explicit `parentId`, derived tree selectors, and tree-aware mutations. That gives you the Workflowy-style outline mode without breaking the simpler list view or forcing a full rewrite of the app.
