# Keyboard Shortcuts Improvement Plan

**Date:** 2026-03-09  
**Scope:** Full audit of all existing shortcuts, gaps, and improvements across the app.

---

## Current Shortcuts Reference

| Key | Action | Documented? |
|-----|--------|-------------|
| `N` | Focus "New item…" topbar input | ✅ |
| `I` | Create new Inbox task | ✅ |
| `X` | Create new Next Action task | ❌ missing from modal |
| `/` | Go to Search | ✅ |
| `K` | Open keyboard shortcuts modal | ❌ not self-documented |
| `8` | Go to Planner | ✅ |
| `1`–`7` | Navigate views (Inbox → Completed) | ✅ |
| `Shift + [` / `Shift + ]` | Cycle areas | ✅ |
| `Ctrl/Cmd + K` | Command palette | ✅ |
| `Ctrl/Cmd + B` | Toggle sidebar | ✅ |
| `Space` | Pause/resume timer (when active) | ✅ |
| `Escape` | Stop timer (when active) | ✅ |
| `P` | Toggle timer picture-in-picture | ✅ |
| `M` | Minimize/expand timer overlay | ❌ missing from modal |
| `Tab` / `Shift+Tab` | Indent/outdent in Outline view rows | ❌ not documented at all |
| `Alt + ↑` / `Alt + ↓` | Move task up/down in Outline view | ❌ not documented at all |
| `Enter` _(outline row focused)_ | Open task detail modal | ❌ not documented at all |
| `Tab` _(GhostItem input)_ | Mark next submission as child/subtask indent | ❌ not documented at all |
| `↑` / `↓` _(GhostItem)_ | Navigate between day-part sections | ❌ not documented at all |

---

## 1. Essentials

_These are gaps or bugs that create real friction or confusion. They require minimal implementation risk and should be done first._

### 1a. Fix the shortcuts modal to document all working shortcuts

The keyboard shortcuts modal (`ShortcutsModal.tsx`) is missing several already-implemented keys. A user pressing `K` to open it has no way to discover these:

- `K` — open shortcuts modal (the modal doesn't list its own trigger key)
- `X` — new Next Action
- `M` — minimize/restore timer
- Outline row: `Tab` / `Shift+Tab` — indent / outdent
- Outline row: `Alt + ↑` / `Alt + ↓` — reorder
- Outline row: `Enter` — open detail
- GhostItem: `Tab` to mark next task as a subtask indent
- GhostItem: `↑` / `↓` to move between day sections

Consider breaking the modal into sections (Navigation, Task Creation, Outline View, Timer) since the list is growing.

---

### 1b. Add Settings shortcut: `,`

Settings navigation has no shortcut at all. The `,` key is a near-universal convention (GitHub, Linear, Notion). Implementation: add a case to the global `keydown` switch for `,` that calls `setCurrentView('settings')`.

---

### 1c. Add "Toggle completed visibility" shortcut: `H`

The eye icon (show/hide completed tasks) is used often and buried in the toolbar. `H` (for "hide/show") maps well and the letter is currently unbound. Implementation: add `case 'h': toggleShowCompletedTasks()` to the global handler.

---

### 1d. Add "Navigate to Today" shortcut: `T`

There is no way to jump to the current day view via keyboard. `T` (for "Today") is unbound and convention-aligned (Things 3, Todoist). Opens the day view for today's date. Implementation: `case 't': navigateToDayView(today)`.

---

### 1e. Document Tab-to-indent in GhostItem with a UI hint

The GhostItem supports `Tab` to set "indent mode" (next task becomes a child of the previous one) but there is zero visual indication this exists. At minimum, a small tooltip or pill label should appear on focus saying something like `Tab ↵ to nest`. This is a powerful subtask creation flow that is completely invisible.

---

## 2. Nice to Haves

_These would meaningfully improve the power-user experience. Each is well-defined but involves slightly more implementation complexity._

### 2a. Toggle List / Outline view: `O`

Currently switching between list and outline modes requires clicking the mode toggle in the toolbar. The letter `O` (for "Outline") is unbound. Implementation: `case 'o': toggleTaskListMode()`. Should be suppressed when focus is in an input.

---

### 2b. Toggle Blocks grouping (day view): `B`

The "Blocks" (group by day part) button is a meaningful toggle that planner-style users reach for often. `B` is currently unbound. Implementation: `case 'b': toggleGroupDayViewByPart()`, only active when `currentView === 'day'`.

---

### 2c. Start timer shortcut from anywhere: `Ctrl/Cmd + G`

Starting a focused-work timer currently requires navigating through the dot icon on a task or through the command palette (`timer:<minutes>`). A direct shortcut (`G` for "Go") or `Ctrl+G` to open a quick timer prompt would speed this up significantly. Could open a mini modal asking for task name + duration, or reuse the command palette `timer:` prefix pre-populated.

---

### 2d. `0` / `\`` to reset planner to current week

When navigating the weekly planner with the arrow buttons, there's no keyboard way to snap back to the present. The `0` key (currently unbound) or backtick fits well here. Implementation: `case '0': setCurrentWeekOffset(0)`, only active in planner view.

---

### 2e. `Escape` to explicitly close task modal

`Escape` currently blurs text inputs and stops the timer. The task detail modal has no keyboard close trigger — it relies on the `click-outside` handler. Adding `Escape` → `closeTaskModal()` would align with universal modal UX. Care required to avoid conflict with the timer stop; priority order should be: (1) close modal if open, (2) blur input if focused, (3) stop timer.

---

### 2f. Add `←` / `→` arrow navigation to collapse/expand sidebar or week offset

In planner view, `←` / `→` (when not in an input) could navigate `currentWeekOffset` back and forward by 1 week. In non-planner views the same keys could collapse/expand the sidebar, mirroring the `Ctrl+B` toggle but with more directional intent.

---

## 3. Possible

_These are larger or more exploratory improvements worth tracking. Implementation is non-trivial and design choices are less obvious._

### 3a. `J` / `K` — vi-style task row focus navigation

Allow `J` / `K` to move keyboard focus down and up through the task list without a mouse. Requires making task rows robustly focusable (they already have `tabIndex={0}` in Outline view but not consistently in List view). Would need a "focused task" tracked in state, separate from selection. Pairs well with 3b.

---

### 3b. Action keys for the focused task (`C`, `S`, `D`)

Once a task row has keyboard focus (see 3a):
- `C` — toggle complete/incomplete  
- `S` — toggle star  
- `D` — open detail modal  
- `Delete` / `Backspace` — delete (with confirmation)

This would make the task list navigable and actionable without a mouse, similar to how email clients work.

---

### 3c. Shift+`J`/`K` — extend multi-selection via keyboard

The app already supports mouse drag / click-shift multi-select. Keyboard-based range selection (Shift+J/K, mirroring Shift+ArrowDown in file managers) would make bulk operations (complete, delete) much faster for power users.

---

### 3d. Numbered project shortcuts

Bind `Ctrl/Cmd + 1` through `Ctrl/Cmd + 5` (or similar) to jump directly to the first 5 projects in the sidebar. The sidebar already orders projects stably. This pattern is established in apps like Slack, VS Code, and Linear.

---

### 3e. Quick timer presets: `Ctrl/Cmd + Shift + 1`–`4`

Allow `Ctrl+Shift+1` = start 15 min timer, `2` = 25 min, `3` = 45 min, `4` = 60 min — all with the current task as the label (if one is focused). This makes the Pomodoro/time-block workflow keyboard-first. Low implementation cost but requires careful key conflict auditing given the number keys already map to views.

---

### 3f. `Ctrl/Cmd + ↑` / `↓` — reorder tasks in List view

The Outline view already supports `Alt+↑/↓` for task reordering. The List view has no keyboard equivalent. Adding `Ctrl+↑/↓` to reorder the focused task would close the gap between the two views' power-user feature parity.

---

### 3g. Smarter `Shift+[/]` area cycling with area indicator

The area cycling shortcut works but offers no feedback beyond the area label in the toolbar. Showing a brief toast or highlight when the area changes would help users know the shortcut landed. Also consider `Alt+1`–`4` as direct jumps to specific areas (Personal, Work, Leisure, Finance) rather than cycling.
