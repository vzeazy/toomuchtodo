# Task List Smart Markdown Editing Plan

## Goal

Simplify the task-list editing experience so it feels like editing a smart interactive markdown todo file instead of juggling multiple row modes, delayed click handlers, and a heavy detail modal, while preserving the functionality the app already has:

- hierarchy
- scheduling and day grouping
- project and area scoping
- notes/markdown
- bulk actions
- drag-based restructuring
- sync-safe local-first mutations

The right move is not to replace the app with a literal plain textarea. The store already has a workable task tree model. The simplification should happen in the interaction model and rendering architecture.

## What Exists Today

### Data and mutation foundation is stronger than the UI layer

The current data model in [src/types.ts](/home/vas/sites/node/toomuchtodo/src/types.ts) and [src/store/useAppStore.ts](/home/vas/sites/node/toomuchtodo/src/store/useAppStore.ts) is already good enough to support a much cleaner editor surface:

- tasks live in a flat ordered array
- hierarchy is represented by `parentId`
- collapse state is represented by `collapsed`
- tree-safe movement already exists in [src/features/tasks/taskTree.ts](/home/vas/sites/node/toomuchtodo/src/features/tasks/taskTree.ts)
- mutations already cover:
  - update
  - complete
  - star
  - set parent
  - move before
  - move after
  - collapse

That is exactly the kind of model a smart outline editor wants under the hood. The backend shape is not the problem.

### The editing experience is currently fragmented across too many surfaces

The user experience for a single task is split across:

- list rows in [src/features/tasks/TaskRow.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskRow.tsx)
- outline rows in [src/features/tasks/OutlineTaskRow.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/OutlineTaskRow.tsx)
- the detail modal in [src/features/tasks/TaskModal.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskModal.tsx)
- the add-task ghost row in [src/components/GhostItem.tsx](/home/vas/sites/node/toomuchtodo/src/components/GhostItem.tsx)
- view orchestration and grouped rendering in [src/features/tasks/TaskListView.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskListView.tsx)

That split creates a lot of interaction overhead:

- single click starts a delayed inline title edit
- double click opens the detail modal
- row menus handle some metadata
- modal handles most metadata
- list mode and outline mode expose different affordances
- adding a child task depends on hidden GhostItem `Tab` state or dedicated subtask controls

This is the main complexity to remove.

### Current click semantics are especially expensive

Both [src/features/tasks/TaskRow.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskRow.tsx) and [src/features/tasks/OutlineTaskRow.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/OutlineTaskRow.tsx) use a `180ms` timeout to distinguish:

- click to edit title
- double click to open details
- modifier click for multi-select

That makes the basic interaction model harder to learn and harder to extend. It is also the opposite of the feeling of editing a markdown todo file, where line focus and text editing should feel immediate and predictable.

### List mode and outline mode are still two separate products

[src/features/tasks/TaskListView.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskListView.tsx) has grown into a large branching renderer that handles:

- list vs outline
- scheduled grouping
- day-part grouping
- selection and marquee
- drag/drop
- ghost inputs
- bulk actions

The current code proves the app supports a lot of useful behavior, but it also shows the list UI is paying a complexity tax for having two row systems with overlapping responsibilities.

### The detail modal is carrying too much of the editing burden

[src/features/tasks/TaskModal.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskModal.tsx) is doing all of this:

- title editing
- notes editing and preview
- subtask management
- parent assignment
- project selection
- area selection
- status selection
- due date editing
- day-part editing
- tags editing
- drag detach behavior

The modal is useful as an escape hatch, but it currently acts as the primary place to do complete edits. That is what makes the list feel shallow and the edit flow feel mode-heavy.

### There is already a markdown-adjacent foundation to build on

The app already has:

- markdown rendering in [src/lib/markdown.ts](/home/vas/sites/node/toomuchtodo/src/lib/markdown.ts)
- a reusable markdown editor in [src/components/MarkdownEditor.tsx](/home/vas/sites/node/toomuchtodo/src/components/MarkdownEditor.tsx)
- markdown export for task lists in [src/lib/taskListExchange.ts](/home/vas/sites/node/toomuchtodo/src/lib/taskListExchange.ts)

So the requested “smart interactive md todo file” direction fits the product. It just has not yet been applied to the primary task-list editor.

## Core Product Direction

### Replace row modes with one canonical task-line editor

The app should converge toward a single task-list editing model that behaves like an outline-first document editor:

- every task is a line
- indentation expresses hierarchy
- checkboxes and collapse affordances stay inline
- line focus is separate from line editing
- editing a line feels immediate, not modal by default
- secondary fields are progressively disclosed rather than hidden behind a totally separate workflow

This means the product should stop thinking in terms of:

- “flat list row” vs “outline row”

and start thinking in terms of:

- “one task line component with multiple display states”

### Keep the current store shape

Do not replace the flat task store with a nested document model.

Keep:

- global ordered task array
- `parentId`
- `collapsed`
- current sync semantics

Why:

- the tree helpers already work
- sync logic already expects task records, not document patches
- grouped day views and filtered views are already derived from task records
- planner and settings features depend on structured task fields

The simplification should happen above the store, not by rewriting persistence.

### The target UX should feel like a smart outline, not a plain markdown textarea

The right metaphor is:

- “interactive outline document with task-aware metadata”

not:

- “raw markdown file in a textarea”

That means:

- keep line-level focus
- keep drag/drop and keyboard restructuring
- keep inline checkboxes
- keep immediate task creation on new lines
- keep rich metadata, but attach it to the focused line in a lightweight way

## Recommended Target Interaction Model

### 1. Single click selects and focuses a line

Single click should no longer rely on timeout-based ambiguity.

It should:

- focus the row
- reveal inline actions for that row
- enable keyboard actions for the focused line

### 2. Enter edits the title, not single-click delay

To preserve fast editing without accidental mode switching:

- `Enter` on a focused line enters title edit mode
- clicking directly into the title text also enters edit mode
- `Escape` exits title edit mode
- `Enter` while editing commits

This is closer to an outline editor and removes the current click-vs-double-click tension.

### 3. Secondary metadata belongs in an expandable inline details panel first

Instead of forcing most edits through `TaskModal`, the focused task should expose lightweight detail editing near the row:

- notes
- due date
- day part
- status
- project
- tags
- area

Recommended shape:

- default: an expandable inline details panel attached to the task line
- optional later enhancement: a contextual side inspector if the layout supports it cleanly

The modal can remain as a fallback for advanced editing or narrow screens, but it should stop being the default path.

### 4. Treat notes as markdown blocks attached to a task line

Notes should behave like attached body text for the focused task:

- visible as a subtle preview beneath the task line when present
- editable inline via the existing markdown editor patterns
- expandable without opening a full modal

This gets the product closer to a markdown document feel.

### 5. Unify add-task and add-subtask into one line-creation model

The current `GhostItem` concept is directionally right, but too hidden.

Creation should work like an outline editor:

- `Enter` on a focused line creates the next sibling
- `Tab` on a focused line indents it under the previous valid parent
- `Shift+Tab` outdents
- a visible “new line” affordance remains at the end of each section and inside empty groups

The current hidden “next add will indent” behavior in [src/components/GhostItem.tsx](/home/vas/sites/node/toomuchtodo/src/components/GhostItem.tsx) should be replaced by more explicit line-based creation semantics.

Important nuance:

- do not remove `GhostItem` completely in the first pass
- empty day-part sections, empty scheduled buckets, and empty project/group surfaces still need a visible insertion target
- instead, restyle `GhostItem` so it looks like an empty task line rather than a special plus-row widget

### 6. Keep grouping, but make it a container concern only

Day-part sections and scheduled-date sections should remain, but they should only manage:

- section heading
- count
- add row
- drop zone

They should not create separate editing models. The same task-line component should render inside every section.

### 7. Promote keyboard-first interactions to first-class behavior

The requested experience wants keyboard editing to feel document-like.

Minimum keyboard set:

- `Up` / `Down` move focus between visible lines
- `Enter` edit title or create next line depending on mode
- `Tab` / `Shift+Tab` indent and outdent
- `Cmd/Ctrl+Enter` open full details fallback
- `Space` or `X` toggle complete when not editing text
- `Delete` or `Backspace` on an empty title line deletes that line with guardrails

Document-editor nuance:

- while the caret is inside a title input, native caret movement should keep working
- only intercept `Up` when the caret is already at the start of the line and `Down` when the caret is already at the end
- this avoids fighting normal text editing

Potential phase-2.5 enhancements once the base interaction is stable:

- `Enter` in the middle of a title splits into a new sibling line
- `Backspace` at the start of an empty or leading-edge line merges into the previous line with subtree-safe guardrails

## Functional Guardrails

These behaviors must survive the simplification.

### Hierarchy and ordering

Keep using:

- `moveTaskSubtree`
- `moveTaskSubtreePreserveParent`
- `updateTaskParent`

from [src/features/tasks/taskTree.ts](/home/vas/sites/node/toomuchtodo/src/features/tasks/taskTree.ts).

Do not regress subtree-safe movement.

### Filtered views

Preserve the current context logic in [src/features/tasks/TaskPanelWrapper.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskPanelWrapper.tsx):

- filtered rows still derive from task records
- outline contexts still include ancestors and descendants when needed
- day and scheduled views still derive from `dueDate` and `dayPart`

### Status and metadata inheritance for subtasks

Current add-subtask flows inherit from the parent:

- status
- area
- project
- due date
- day part

That inheritance is important and should remain. It is one of the reasons the app already feels smart. The new line-creation model should call the same logic rather than inventing a separate document-only path.

### Bulk selection

The current selection model in [src/features/tasks/TaskListView.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskListView.tsx) supports:

- click selection
- shift range selection
- cmd/ctrl multi-select
- alt-drag marquee

Do not remove it. But separate it cleanly from row-edit mode so selection and editing stop competing for the same click behavior.

### Sync safety

All edits still need to resolve through store mutations in [src/store/useAppStore.ts](/home/vas/sites/node/toomuchtodo/src/store/useAppStore.ts). Do not introduce a second editing state model that bypasses normal task updates for long periods.

Recommendation:

- keep ephemeral local draft state only for the focused line or notes editor
- commit through existing mutation functions quickly
- avoid long-lived unsynced document buffers

### Filter-context ancestor rows need explicit rules

In outline mode, [src/features/tasks/TaskPanelWrapper.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskPanelWrapper.tsx) includes ancestor rows for context even when those rows are not direct matches.

The simplified editor must define what is allowed on those rows:

- can they be edited directly in filtered contexts
- does `Enter` create a sibling in the filtered scope or a child under that ancestor
- should context ancestors be visually marked as partially read-only in some views

Do not leave this ambiguous.

## Recommended Architecture

### 1. Introduce a single `TaskLine` primitive

Create a new component that becomes the canonical renderer for task items in task-list contexts.

Responsibilities:

- render checkbox
- render indentation
- render collapse affordance when needed
- render title in view/edit states
- render compact metadata tokens
- render optional notes preview
- expose focused state
- expose inline detail toggle
- expose drag affordances

This should replace most divergence between:

- [src/features/tasks/TaskRow.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskRow.tsx)
- [src/features/tasks/OutlineTaskRow.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/OutlineTaskRow.tsx)

### 2. Prefer DOM focus and `:focus-within` over heavy React focus state

Avoid making `focusedTaskId` a central high-churn React state unless profiling proves it is necessary.

Preferred first approach:

- let the active input own native DOM focus
- use row-level `:focus-within` styling for the active task line
- keep React state only for edit-expansion concerns such as inline notes/details panels
- use a small keyboard navigation helper to move focus between visible task inputs

This reduces list-wide re-renders and avoids fighting browser caret behavior.

### 3. Add explicit task-list interaction state where it is actually needed

`TaskListView` currently owns selection and grouping state, but not a clean “focused line / edit mode” model.

Add explicit local state for:

- `editingTaskId` only if DOM focus is not sufficient
- `expandedTaskId` for inline details/notes
- optional draft buffers for title and notes

This makes the list act like an editor instead of a collection of unrelated row widgets.

### 4. Split section rendering from row rendering

Refactor [src/features/tasks/TaskListView.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskListView.tsx) into:

- section builders
- ordered visible line ids
- a single row renderer
- a single add-line renderer

This should reduce the large branching surface and make grouped day view, scheduled view, and plain view share the same interaction primitives.

### 5. Downgrade `TaskModal` to advanced/fallback editing

Keep [src/features/tasks/TaskModal.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskModal.tsx), but reposition it as:

- advanced editing
- narrow-screen fallback
- task deep-dive surface

Move common edits out of it:

- title
- notes
- due date
- status
- tags
- project

Those should be accessible from the list itself.

### 6. Reuse `MarkdownEditor` behavior for inline notes

Pull the existing interaction rules from [src/components/MarkdownEditor.tsx](/home/vas/sites/node/toomuchtodo/src/components/MarkdownEditor.tsx) into the task-line notes experience instead of keeping the custom notes edit logic embedded inside `TaskModal`.

## Phased Plan

### Phase 1. Unify row rendering first

- build the shared `TaskLine` primitive
- prove it can render current list and outline contexts without regressing drag/drop, selection, or grouped views
- keep current interaction semantics temporarily if needed during this convergence
- reduce the branching inside `TaskListView`

Deliverable:

- one canonical row implementation
- lower UI duplication before deeper interaction rewrites

### Phase 2. Interaction cleanup and keyboard contract

- document current row interactions and remove timeout-driven click ambiguity
- prefer DOM-focus-driven active-row behavior over a global React `focusedTaskId`
- separate selection state from editing state
- define the keyboard contract for task-line navigation and editing

Deliverable:

- the list feels predictable before any major visual rewrite

### Phase 3. Inline title editing and keyboard line creation

- make focus explicit
- move title edit entry to direct text click or `Enter`
- support sibling creation from focused lines
- support indent/outdent from the same focused-line model
- keep `GhostItem`, but restyle it as an empty task line and retire the hidden “tab changes next ghost add to indent” behavior

Deliverable:

- editing feels like working in an interactive outline

### Phase 4. Inline notes and metadata inspector

- show notes previews below lines when present
- support inline markdown notes editing using shared editor behavior
- add an expandable inline detail panel as the default metadata surface
- evaluate a side inspector later only if it materially improves desktop flow without forcing a layout rewrite
- keep modal fallback only for advanced edit depth

Deliverable:

- most task edits happen in place

### Phase 5. Remove obsolete UI paths and simplify code

- reduce duplicated row-only code paths
- shrink `TaskModal`
- simplify grouping branches in `TaskListView`
- update shortcuts documentation and visible affordances
- add regression tests for move, edit, and filtered-view behavior

Deliverable:

- smaller conceptual surface
- lower maintenance cost

## Implementation Notes and Tradeoffs

### Recommendation: keep `list` and `outline` as settings temporarily

Do not rip out the setting immediately.

Short term:

- keep both modes visible if needed
- internally converge them onto the same line primitive

Later:

- decide whether the distinction still matters once the line editor is good enough

This reduces migration risk.

### Recommendation: default to inline expansion before a side inspector

An inline expansion model is better aligned with the current layout and less risky than introducing a persistent side rail into the centered panel structure in [src/features/tasks/TaskPanelWrapper.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskPanelWrapper.tsx).

Treat a side inspector as optional future refinement, not as a dependency for the simplification.

### Recommendation: do not turn metadata into inline markdown syntax in v1

It is tempting to encode things like:

- `@project`
- `#tag`
- `due:2026-04-03`

directly inside the title line parser.

Do not make that the first step.

Reason:

- parsing and round-tripping becomes fragile
- it can fight with ordinary writing
- it complicates sync and partial edits
- it is not required to achieve the desired feel

First make the editor behave like a smart markdown outline. Then consider optional inline command parsing as a power-user enhancement.

### Recommendation: preserve drag/drop, but reduce visual noise

The current drop logic is useful. Keep it, but apply it to the unified task line instead of maintaining separate drag behaviors in two row components.

### Recommendation: favor a side inspector over heavy inline prop soup

If too many metadata controls get embedded directly into every row, the list will become visually noisy again.

Best balance:

- row stays document-like
- focused row reveals light tokens and status
- side inspector handles secondary fields cleanly

## Risks

### Risk: trying to simulate a raw markdown file too literally

If the UI becomes a single textarea-like editor, the app will lose important structured behaviors:

- drag/drop
- stable task ids
- grouped sections
- metadata controls
- sync-friendly incremental updates

Avoid this.

### Risk: preserving both current row systems for too long

If `TaskRow` and `OutlineTaskRow` both remain first-class, the app will keep paying the current maintenance cost and interaction drift will continue.

### Risk: editing state conflicts with bulk selection

Selection must remain possible, but editing and selection need distinct rules. Focused row state is the missing layer that will let both coexist cleanly.

### Risk: keyboard navigation can break native text editing

If `Up` and `Down` are intercepted too aggressively, the title field will feel broken. Any keyboard-navigation layer must respect caret position first and only traverse rows at title boundaries.

### Risk: context ancestors behave unpredictably in filtered views

Context rows injected for outline filtering are useful for orientation, but they complicate creation and edit semantics. The implementation needs explicit rules here before shipping.

### Risk: modal dependence never really goes away

If the inline inspector is too weak, the product will still feel modal-heavy. The plan only succeeds if the common edits move into the list itself.

## Gemini Review Adjustments

After a Gemini 3.1 Pro codebase review, these adjustments were accepted into the plan:

- keep the flat task store and current tree mutation layer exactly as the foundation
- converge row rendering before rewriting the whole interaction model
- keep `GhostItem`, but visually collapse it into an empty-line affordance so empty groups still have a clean insertion target
- prefer DOM focus plus `:focus-within` over a high-churn `focusedTaskId` React state
- make expandable inline details the default path before considering a desktop side inspector
- account explicitly for context-ancestor rows in filtered outline views
- preserve native caret movement and only traverse rows with `Up` / `Down` at line boundaries
- consider document-style split and merge actions only after the base line editor is stable

## Recommendation

Build this as a task-outline editor refactor, not as a markdown export/import feature.

The app already has the structured task engine needed to behave like a smart interactive todo document. The win now is to collapse the UI onto one canonical line editor, move common edits in-place, and demote the modal to an advanced fallback. That gets you much closer to the feel you want without sacrificing hierarchy, metadata, scheduling, planner integration, or sync behavior.
