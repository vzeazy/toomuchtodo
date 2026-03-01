# Product UI Refactor Plan

## Goal

Address the current UX bugs and add the missing foundation needed for settings, theming, search, tagging, markdown notes, and a minimal command palette without compounding the current maintenance problem.

## Progress Log

### 2026-03-01 - Phase 1 completed

- Fixed planner date rendering to use the actual visible week dates instead of a hardcoded `2023` label.
- Replaced the hardcoded Wednesday highlight with a real `isToday` comparison.
- Added a visible week range label beside planner navigation so week travel is clearer.
- Reworked the task row overflow menu into a viewport-level overlay so it is no longer clipped by the list container.
- Added an `Open task` action to the task row menu.
- Added note indicators for tasks that contain notes in both list and planner contexts.
- Replaced default browser checkbox styling with a custom dark-themed task checkbox control.

Nuance:

- The app still uses root-level files and CDN Tailwind at this point. The structural refactor remains necessary before settings, themes, and search land cleanly.

### 2026-03-01 - Phases 2 through 6 completed

- Moved the app into a modular `src/` structure with separate feature folders for planner, tasks, search, settings, themes, and command palette.
- Replaced the previous task/project-only persistence with a versioned app state model that now stores tasks, projects, settings, and custom themes together.
- Added a dedicated settings screen reachable from the bottom of the sidebar.
- Added JSON export and import support for full app data.
- Added a semantic theme system driven by token objects and CSS variables.
- Migrated the app visual system onto theme tokens and added built-in themes:
  - `Midnight Blueprint`
  - `Graphite Terminal`
  - `Paper Ledger`
  - `Forest Dusk`
- Added the agent-assisted theme workflow:
  - user enters a brief
  - app generates the full prompt
  - user copies that prompt to any LLM
  - user pastes returned JSON back into the app
  - app validates and saves the theme
- Extended tasks with tag support and surfaced tags in the task modal, list rows, and search.
- Added a sidebar search box that automatically opens a dedicated search view.
- Added `/` as a search shortcut and `Ctrl/Cmd + K` for the minimal command palette.
- Added markdown note editing and preview toggling in both the expanded task row and the task modal.
- Added a minimal command palette with core navigation, theme cycling, export, and help actions.

Nuances:

- The app remains on the current lightweight stack and still relies on Tailwind utility classes from the CDN, but the file layout and state model are now much more maintainable.
- Markdown rendering is intentionally lightweight and local rather than dependency-heavy. It currently supports headings, bullet lists, emphasis, links, and inline code.
- Import validation is intentionally conservative at the shape level for app data and stricter for custom theme JSON, where token color validation matters most.

### 2026-03-01 - Post-phase theme polish pass

- Installed the external `frontend-design` skill from the requested Anthropic repository for design guidance.
- Refined the default `Midnight Blueprint` theme to restore a cleaner and more intentional visual hierarchy.
- Added stronger atmospheric layering to the app shell, including restrained accent glows, subtle grid texture, and more nuanced panel depth.
- Reworked typography to use a higher-character display serif for major headings and a cleaner sans-serif for body UI.
- Polished the header, sidebar rail, planner cards, task list container, settings panels, search results, modals, and command palette so they now read as one coherent visual system rather than generic utility surfaces.

Nuance:

- This pass focused on the default theme and shared shell surfaces. The theme token system remains intact, so additional themes and agent-generated themes still slot into the same architecture.

## Current State Summary

The app is currently concentrated in a single [`App.tsx`](/home/vas/sites/node/toomuchtodo/App.tsx) file with local component definitions and inline styling decisions. State is managed from [`store.ts`](/home/vas/sites/node/toomuchtodo/store.ts) with `localStorage` persistence for tasks and projects only. The existing structure is fast to iterate in, but most of the requested work crosses concerns and will become increasingly fragile unless structure and state shape are improved first.

## Confirmed Findings

### Weekly planner navigation

- Week navigation controls already exist in [`App.tsx`](/home/vas/sites/node/toomuchtodo/App.tsx#L427), using `currentWeekOffset`.
- The planner header hardcodes the year as `2023` in [`App.tsx`](/home/vas/sites/node/toomuchtodo/App.tsx#L514), which makes the view look wrong even when date math is correct.
- Planner highlighting is hardcoded to `WEDNESDAY` in [`App.tsx`](/home/vas/sites/node/toomuchtodo/App.tsx#L515), which explains the incorrect current-day highlight.

### Settings and import/export

- There is no settings view, no settings model, and no sidebar entry for settings in [`App.tsx`](/home/vas/sites/node/toomuchtodo/App.tsx).
- [`store.ts`](/home/vas/sites/node/toomuchtodo/store.ts) persists tasks and projects, but there is no import/export format or versioned app data schema.

### Task list issues

- The checkbox styling is default browser styling with `accent-[#0055ff]` in both the list and modal at [`App.tsx`](/home/vas/sites/node/toomuchtodo/App.tsx#L125) and [`App.tsx`](/home/vas/sites/node/toomuchtodo/App.tsx#L250).
- The 3-dot menu is positioned inside each row with row-level `z-index` changes in [`App.tsx`](/home/vas/sites/node/toomuchtodo/App.tsx#L238), which is a likely source of overlay stacking problems.
- The 3-dot menu currently supports project reassignment and delete only in [`App.tsx`](/home/vas/sites/node/toomuchtodo/App.tsx#L270).
- Notes already exist as `description`, but tasks do not show any note indicator in the list.

### Missing data model support

- Tasks do not currently support tags in [`types.ts`](/home/vas/sites/node/toomuchtodo/types.ts#L8).
- There is no theme model, theme registry, or settings schema in [`types.ts`](/home/vas/sites/node/toomuchtodo/types.ts) and [`store.ts`](/home/vas/sites/node/toomuchtodo/store.ts).
- Search is limited to browser-native text scanning; there is no query state, search index, or dedicated search view.

### App structure risk

- Most UI, state wiring, keyboard shortcuts, planner logic, modal logic, and list rendering live in a single file: [`App.tsx`](/home/vas/sites/node/toomuchtodo/App.tsx).
- Several requested features overlap heavily, so implementing them directly in the current shape would increase coupling and regressions.

## Recommended Delivery Strategy

### Phase 1: Stabilize the existing app shell

Scope:

- Fix weekly planner date rendering.
- Fix current-day highlight logic.
- Confirm week navigation behavior and make it visible and intuitive.
- Fix task list 3-dot menu stacking issue.
- Add "Open task" action to the 3-dot menu.
- Add note indicator for tasks that have non-empty notes.
- Restyle the checkbox/todo control to match the dark theme.

Implementation direction:

- Replace planner highlight logic with an `isToday` comparison against the actual local date string.
- Derive year/month/day labels from the actual planner `Date` object instead of hardcoding.
- Keep week navigation state, but make the label explicit, for example "This Week", "Next Week", or a date range.
- Move the row action menu to a portal-based overlay or a shared popover layer so it no longer depends on table/row stacking context.
- Add an "Open task" menu item that sets `taskToEditInModal`.
- Add a note icon for `task.description.trim().length > 0`.
- Replace default checkbox styling with a themed custom control component.

Reason for doing this first:

- These are direct user-facing bugs and quality issues.
- They can be completed before major structural work and provide safer ground for later changes.

### Phase 2: Introduce maintainable structure

Scope:

- Break the app into feature-oriented files and shared primitives.
- Centralize view routing and keyboard shortcuts.
- Prepare state types for themes, settings, tags, and search.

Recommended target structure:

- `src/app/` for app shell and high-level routing/state bootstrapping.
- `src/features/planner/`
- `src/features/tasks/`
- `src/features/projects/`
- `src/features/settings/`
- `src/features/search/`
- `src/features/themes/`
- `src/components/` for shared primitives such as buttons, checkboxes, icons, modals, popovers.
- `src/store/` for state logic, persistence, import/export serialization, migrations.
- `src/lib/` for date helpers, keyboard helpers, theme helpers, and markdown utilities.

Implementation direction:

- Move task row, task modal, sidebar item, shortcuts modal, planner grid, and header into separate files first.
- Introduce a small app view model instead of overloading `ViewType` with every screen state.
- Add a normalized persisted state shape with a schema version.

Reason for doing this before settings/themes/search:

- Those features need shared primitives and non-fragile state wiring.
- A modular structure is necessary if agents are expected to add themes later.

### Phase 3: Add settings foundation

Scope:

- Add a dedicated settings area accessible from the bottom of the left sidebar.
- Add import/export options inside settings.
- Add future-facing sections for theme management and keyboard shortcuts.

Implementation direction:

- Add a `settings` app view and a bottom-anchored sidebar entry.
- Create sections such as `General`, `Themes`, `Data`, and `Shortcuts`.
- Export a versioned JSON payload containing tasks, projects, settings, themes, and metadata.
- Import via validation plus migration so older exports remain loadable.

Recommended export shape:

```json
{
  "version": 1,
  "exportedAt": "2026-03-01T00:00:00.000Z",
  "app": "too-much-to-do",
  "data": {
    "tasks": [],
    "projects": [],
    "settings": {},
    "themes": []
  }
}
```

Risks to address:

- Import must validate unknown or malformed JSON.
- Theme import should not be allowed to inject arbitrary CSS strings without validation.

### Phase 4: Theme system

Scope:

- Add a modular theme system.
- Convert the existing dark theme into the new format.
- Ship a few built-in themes.
- Add the agent-assisted custom theme workflow.

Implementation direction:

- Replace hardcoded color classes and hex values with CSS variables applied from a theme object.
- Define a `ThemeDefinition` JSON format with semantic tokens instead of raw component styling.
- Load theme tokens into `:root` or a theme-scoped container.
- Keep theme definitions constrained to semantic slots such as:
  - `surface.base`
  - `surface.elevated`
  - `surface.panel`
  - `border.default`
  - `text.primary`
  - `text.muted`
  - `accent.primary`
  - `accent.secondary`
  - `danger`
  - `success`
  - `focusRing`

Built-in themes to add:

- `Midnight Blueprint` as the current dark theme migrated into token form.
- `Graphite Terminal` with higher-contrast monochrome dark styling.
- `Paper Ledger` as a light theme for contrast testing.
- `Forest Dusk` as a softer dark alternative.

Agent-assisted theme creation flow:

- Settings should provide a "Generate Theme Prompt" action.
- The app should assemble and copy an extended prompt describing:
  - product context
  - design goals
  - semantic token rules
  - required JSON schema
  - validation constraints
- User sends that prompt to their preferred LLM.
- User pastes returned JSON into the app.
- The app validates and stores the new theme.

Reasonable constraints:

- Do not allow arbitrary CSS.
- Do not require agents to understand component internals.
- Keep token count low enough that themes remain easy to generate reliably.

### Phase 5: Tasks, notes, tags, and search

Scope:

- Add task tagging.
- Add smart search with dedicated search view from the sidebar.
- Add keyboard shortcut to trigger search.
- Add markdown live render for task notes with smart edit/view toggling.

Implementation direction:

- Extend `Task` with `tags: string[]`.
- Add a tag input and tag chips in the task modal.
- Add a search box in the sidebar that opens a dedicated search view automatically when focused or queried.
- Search should cover title, notes, tags, project name, area, and status.
- Start with efficient in-memory search using precomputed normalized strings; only consider fuzzy ranking if basic search proves insufficient.
- Add a shortcut such as `/` or `Cmd/Ctrl+K` for search, while reserving the same command infrastructure for the command palette.
- For notes, support:
  - markdown edit mode
  - rendered preview mode
  - smart click behavior where clicking rendered content enters edit mode, and blur or explicit toggle returns to preview

Dependencies:

- This phase should happen after the structural refactor and settings/theme groundwork.

### Phase 6: Minimal command palette

Scope:

- Add a lightweight command palette with a minimal initial action set.

Recommended initial commands:

- Navigate to Inbox / Next / Planner / Settings / Search
- Add new task
- Toggle theme
- Export data
- Import data
- Open keyboard shortcuts

Implementation direction:

- Reuse the search overlay and keyboard infrastructure where possible.
- Keep command registration declarative so more commands can be added without editing the modal internals.

## Item-by-Item Mapping

| Request | Current status | Recommended phase |
|---|---|---|
| Weekly planner week travel | Partially implemented, needs better UX and validation | 1 |
| Current correct day highlight | Bug confirmed, hardcoded Wednesday | 1 |
| Dedicated settings area | Missing | 3 |
| Settings import/export | Missing | 3 |
| Note icon on tasks | Missing | 1 |
| Cleaner themed todo checkbox | Missing | 1 |
| Modular theme support | Missing | 4 |
| Built-in base themes | Missing | 4 |
| 3-dot menu overlay index | Bug likely caused by local stacking context | 1 |
| 3-dot menu opens task modal | Missing | 1 |
| Task tagging | Missing | 5 |
| Sidebar search + search view | Missing | 5 |
| Search keyboard shortcut | Missing | 5 |
| More maintainable app structure | Needed before larger features | 2 |
| Markdown live render notes | Missing | 5 |
| Minimal command palette | Missing | 6 |

## Suggested Order Of Execution

1. Fix planner bugs, row menu overlay, note indicator, modal action, and checkbox styling.
2. Split the monolith into app shell, planner, tasks, sidebar, modal, and shared UI primitives.
3. Introduce versioned persisted state plus settings screen and import/export.
4. Implement semantic theme tokens, migrate current dark theme, and add built-in themes.
5. Add tags, smart search, markdown note rendering, and related shortcuts.
6. Add the minimal command palette on top of the shared search/overlay infrastructure.

## Acceptance Criteria

### Planner

- User can move to previous and next weeks and clearly understand which week is being shown.
- The actual current day is highlighted only when the visible week contains today.
- Planner header shows the correct date values, including year.

### Settings and data portability

- Settings is reachable from the bottom of the sidebar.
- Export downloads a valid JSON file with schema version and metadata.
- Import validates and applies supported data safely.

### Task UX

- Tasks with notes show a note indicator in list and planner contexts where appropriate.
- The row action menu always appears above neighboring content.
- The row action menu includes an "Open task" action.
- Todo controls visually match the active theme.

### Themes

- Theme tokens can drive the app without editing component code.
- A new built-in theme can be added by creating a JSON definition and registering it.
- Custom theme JSON pasted by the user is validated before persistence.

### Search and productivity

- Focusing the sidebar search opens a dedicated search results view.
- Search can be triggered by keyboard shortcut.
- Markdown notes render live in preview mode and remain easy to edit.
- A minimal command palette can execute core navigation and data actions.

## Open Questions To Resolve During Implementation

- Should tags be freeform only, or should the app later support saved/global tags?
- Should search results be grouped by tasks/projects/commands, or remain task-only at first?
- Should imported custom themes be per-device only via `localStorage`, or eventually exportable and shareable by default?
- Should markdown rendering support task links, checklists, and code blocks in v1, or stay basic?

## Recommendation

Do not implement the larger feature set directly in the current one-file structure. The safest approach is a two-step start:

1. Ship the obvious UX bug fixes and list interaction fixes first.
2. Immediately move into the structural split before adding settings, theme infrastructure, tagging, and search.
