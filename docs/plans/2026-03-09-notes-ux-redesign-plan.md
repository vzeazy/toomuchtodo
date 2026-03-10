# Notes UI/UX Redesign Plan

## Problem Statement

The notes implementation is technically solid (sync, model, CRUD all work), but the UI is invasive, misaligned, and confusing. Specific issues:

1. **ScopedNotesSection hijacks task panels.** A large widget (preview cards grid + full inline editor) appears above *every* task list when a project/area/day is active. This obliterates the task-first flow the app is built around. Users open a project panel to see their tasks, not a note manager.

2. **NotesDashboardView uses a foreign layout.** The two-column grid (list sidebar + sticky editor) is a Notion-ish pattern that clashes with every other view in the app. SearchView and SettingsView both use a single centered column — the Notes dashboard should too.

3. **Too many simultaneous note creation surfaces.** Notes can be created from the scoped section's "New note" button, the dashboard "New note" button, the command palette `note:` prefix, and the `new-dashboard-note` palette command. The mental model is fragmented.

4. **Inline editor inside the scoped section is overkill.** Preview cards + an active editor card, both visible at once with no clear hierarchy, adds visual noise and requires multiple interactions to do anything useful.

5. **TaskPanelWrapper has ballooned in complexity.** It now carries `updateNote`, `deleteNote`, `toggleNotePinned`, and `onOpenNotes` props that exist solely to power the scoped section — all of which flow through App.tsx three times (once per panel slot).

## Design Principles

- **Task panels are for tasks.** Notes are a companion, not a peer. Access should be lightweight and optional.
- **Match the app's single-column pattern.** Every view that isn't the planner is a centered max-width column.
- **One primary way to do a thing.** One entry point for notes (sidebar), one way to create a note in context (a single button), one editor surface.
- **Expand in place instead of side panels.** The app's existing expand pattern (task description inline) is the right idiom for showing an editor.

## Proposed Changes

### 1. Remove ScopedNotesSection from task panels

**What**: Delete the `ScopedNotesSection` rendering block and the associated note props from `TaskPanelWrapper`.

**Replacement**: A single small **"Notes (N)"** action button rendered inside `TaskPanelWrapper`, in the panel header area (alongside the PiP pop-out button). Clicking it:
- If in a project/day/area context: creates no note, just navigates to the Notes dashboard pre-filtered to that scope.
- Or: shows a lightweight inline "quick note" input (title only + optional body) that creates the scoped note and then routes to the dashboard showing it.

The simplest version: just a small `FileText` icon link in the panel header that navigates to Notes filtered to the current scope. No inline editor in the task panel at all.

**Props to remove from TaskPanelWrapper**: `updateNote`, `deleteNote`, `toggleNotePinned`, `onOpenNotes`. Keep `addNote` for the optional quick-note entry point, or remove it entirely if we go with navigation-only.

### 2. Redesign NotesDashboardView — single-column accordion

**What**: Replace the two-column grid with a single-column list, matching `SearchView`'s pattern.

**Layout**:
```
[NOTES kicker] [h1 "Notes"] [N notes subtitle]    [+ New Note button]

[Search bar — full width, simple input with icon]
[Scope filter pills row]

[notes list — panel-surface rounded-[28px]]
  [note row: title · scope label · excerpt · timestamp · pin icon]
  [note row: ...] ← clicking expands inline below the row
    ↳ [expanded: title input + MarkdownEditor + pin/delete actions]
       [border-t soft-divider, no heavy card background]
  [note row: ...]
```

Each row is a `<button>` that sets `expandedNoteId`. The expanded area uses a `<div>` with the title input, body editor, and action row — no separate card wrapper. Collapsing on second click or when another row is clicked.

Empty state follows the same pattern as SearchView.

**Remove**: `filteredNotes` split into pinnedNotes/recentNotes sections (unnecessary visual grouping). Pin status is shown as a small star icon on the row instead of a separate section. Keep sort order (pinned first, then by updatedAt).

### 3. Simplify NoteEditorCard (or inline it)

Since the expanded editor in the new dashboard doesn't need a card wrapper, `NoteEditorCard` should either:
- Be simplified to just the inner content (title + editor + actions) without the `panel-surface rounded-[28px]` shell, or
- Be replaced with inline JSX inside the accordion expansion

Either way, remove the heavy card framing. The list row's expansion uses a simple `border-t soft-divider mt-3 pt-3` separator.

### 4. Command palette cleanup

- Remove the `note-help` disabled hint item (it shows "Type after note: to create a dashboard note" which is visible but non-actionable — confusing).
- Keep `note:` prefix, `goto-notes`, and `new-dashboard-note` commands.

### 5. App.tsx cleanup

Remove note props passed to each TaskPanelWrapper instance:
- `updateNote`, `deleteNote`, `toggleNotePinned`, `onOpenNotes`
- Keep `addNote` if the small notes button in the panel header uses it

Simplify or remove `notesViewFocus` state — the dashboard can use URL params or just local filter state without needing to be driven from App.tsx.

## Files to Change

| File | Change |
|------|--------|
| `src/features/tasks/TaskPanelWrapper.tsx` | Remove ScopedNotesSection block + 4 note props. Add lightweight notes link button in header. |
| `src/features/notes/NotesDashboardView.tsx` | Full rewrite to single-column accordion list pattern. |
| `src/features/notes/NoteEditorCard.tsx` | Remove card wrapper, keep editor content (title + body + actions). |
| `src/app/App.tsx` | Remove 4 note props from each TaskPanelWrapper call. Simplify/remove notesViewFocus. |
| `src/features/command-palette/CommandPalette.tsx` | Remove disabled hint item. |
| `src/features/notes/ScopedNotesSection.tsx` | Delete file (no longer used). |

## Out of Scope

- Backend, sync, worker changes — already solid, no changes needed.
- `noteUtils.ts`, `types.ts`, `store`, migrations — no changes needed.
- Tests — only update if import references break.

## Implementation Phases

### Phase 1 — Strip the invasive parts ✅ DONE
1. Removed `ScopedNotesSection` and its 4 note-editing props from `TaskPanelWrapper`
2. Deleted `ScopedNotesSection.tsx`
3. Added a `Notes (N)` link button to the panel header — joins the existing PiP pop-out button in a shared absolute flex row (top-right corner); clicking navigates to notes dashboard filtered to the current scope (project/day/area)
4. Build passed ✓

**Nuance**: Refactored the panel header actions (PiP + Notes + optional close) into a single `panelActions` flex div at `absolute top-0 right-0` so buttons don't need manual offset positioning math.

### Phase 2 — Redesign the dashboard ✅ DONE
1. Rewrote `NotesDashboardView` as single-column accordion list (max-w-3xl, matches SearchView pattern)
   - Note rows show title + scope label + timestamp + 2-line excerpt
   - Clicking a row expands an inline editor (title input + MarkdownEditor + pin/delete)
   - Clicking again collapses; clicking a different row collapses current and expands new one
   - Search bar moved to full-width above filter pills
   - Removed the two-column grid and the Pinned/Recent section split
2. Simplified `NoteEditorCard` — removed `panel-surface rounded-[28px] p-5` card shell; now just bare editor content (scope label + title + timestamp + body + actions) for embedding
3. Removed the disabled `note-help` hint item from command palette (empty `note:` query now returns `[]`)
4. Build + all 7 tests passed ✓

## Success Criteria

- Opening a project/area/day panel shows *only* tasks — no notes section above the list
- Notes are accessible via the sidebar and a subtle link in the panel header
- The Notes dashboard looks and feels consistent with SearchView/SettingsView
- Creating and editing a note requires ≤ 2 clicks from anywhere in the app
- `npm run build` and `npm test` both pass
