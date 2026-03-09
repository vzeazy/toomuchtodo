# URL Routing Plan

**Date:** 2026-03-09  
**Scope:** Replace ephemeral React state navigation with hash-based URLs so that refreshing the browser restores the user's exact location.

---

## Progress Updates

### Milestone 1 — Routing foundation implemented

- Added `src/lib/routing.ts` with `AppLocation`, `parseHash`, and `serializeHash`
- Added `src/lib/useAppLocation.ts` to initialize from `window.location.hash`, push hash history on in-app navigation, and sync state on `hashchange`
- Refactored `src/app/App.tsx` to replace the four navigation `useState` values with `useAppLocation()`
- Updated direct navigation setter call sites for planner/day arrows, project/day drill-downs, settings navigation, and project deletion cleanup

**Nuance:** location normalization intentionally keeps URL state limited to the plan's scope: planner week offset, day date, and project selection. Transient UI state like sidebar collapse, search query, modals, and multi-panel state remains ephemeral.

### Milestone 2 — Validation completed

- Verified the app still builds with `npm run build`
- Ran a Playwright smoke test against a local Vite server covering:
  - `#planner?week=-2` refresh and reset-to-today behavior
  - `#day?date=2026-03-09` refresh and date-preserving day navigation
  - project drill-down to `#all?project=<id>` plus browser Back behavior
  - settings navigation and refresh persistence at `#settings`

**Nuance:** the smoke test seeded localStorage with a minimal app state so project/day routes could be exercised deterministically without changing app code or introducing new dependencies.

**Status:** implementation and validation complete.

---

## Problem Statement

All navigation in the app is held in `useState` inside `App.tsx`:

```ts
const [currentView, setCurrentView] = useState<AppView>('planner');
const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
const [selectedPlannerDate, setSelectedPlannerDate] = useState<string | null>(null);
const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
```

This means that pressing **Refresh** always resets the user to the planner view, losing context entirely. There is no history integration, so the browser Back button also does nothing useful.

---

## Chosen Approach: Hash-Based Routing (no library)

The app is a **single-page, fully client-side app** deployed as a SPA (Vite + Cloudflare). There is no server-side routing, and no `react-router` is installed or needed.

The simplest, zero-dependency solution is to **encode the active location in `window.location.hash`** and read it back on mount. This requires:

- No new npm packages
- No server-side changes
- No changes to `vite.config.ts` or `public/_redirects`
- Full compatibility with Cloudflare Pages (hash URLs are never sent to the server)

### Why not `react-router`?

Installing React Router is reasonable but it is a meaningful dependency upgrade for a problem that hash routing solves completely. The app has a flat, well-defined view model — it is not a complex multi-page app. A lightweight custom hook is sufficient and keeps the bundle lean.

### Why not `history.pushState` (path-based routing)?

Path-based routing (`/planner`, `/inbox`, `/project/abc123`) requires the server to serve `index.html` for every path. On Cloudflare Pages this needs a `public/_redirects` file or a Pages routing config. While achievable, it adds server-side configuration that can silently break on deploys. Hash routing avoids the problem entirely.

---

## URL Schema

| Location | Hash |
|---|---|
| Planner (current week) | `#planner` |
| Planner (offset week) | `#planner?week=-2` |
| Day view | `#day?date=2026-03-09` |
| Inbox | `#inbox` |
| Next | `#next` |
| Waiting | `#waiting` |
| Scheduled | `#scheduled` |
| Someday | `#someday` |
| Focus | `#focus` |
| Completed | `#completed` |
| Project | `#all?project=<projectId>` |
| Settings | `#settings` |
| Search | `#search` |

All parameters sit after the `?` inside the hash (e.g. `#day?date=2026-03-09`) — this is a common pattern and fully supported by all browsers.

---

## Implementation Plan

### Step 1 — Create `src/lib/routing.ts`

A small utility module with two pure functions:

```ts
export interface AppLocation {
  view: AppView;
  projectId: string | null;
  dateStr: string | null;
  weekOffset: number;
}

/** Parse window.location.hash → AppLocation */
export function parseHash(hash: string): AppLocation

/** Serialize AppLocation → hash string */
export function serializeHash(loc: AppLocation): string
```

**`parseHash` logic:**
1. Strip the leading `#`
2. Split on `?` — left side is the view, right side is parsed with `URLSearchParams`
3. Validate the view against the `AppView` union; fall back to `'planner'` if unrecognized
4. Extract `project`, `date`, and `week` params

**`serializeHash` logic:**
1. Start with the view string
2. Append `?project=<id>`, `?date=<dateStr>`, or `?week=<n>` as needed
3. Skip params that are null or zero (keeps URLs clean)

---

### Step 2 — Create `src/lib/useAppLocation.ts`

A custom React hook that owns the location state and keeps the hash in sync:

```ts
export function useAppLocation(): {
  view: AppView;
  projectId: string | null;
  dateStr: string | null;
  weekOffset: number;
  navigate: (loc: Partial<AppLocation>) => void;
}
```

**Internal behavior:**

1. **Initial state** — call `parseHash(window.location.hash)` on first render (replaces the `useState('planner')` defaults in `App.tsx`)
2. **`navigate()`** — merges the partial update into the current location, then calls `window.history.pushState(null, '', '#' + serializeHash(next))` so that Back/Forward work correctly
3. **`hashchange` listener** — a `useEffect` that listens for `window.addEventListener('hashchange', ...)` and calls the internal state setter when the user navigates with Back/Forward
4. **Write-on-change** — a `useEffect([view, projectId, dateStr, weekOffset])` that writes `window.location.hash` whenever any of these values change from within the app

The hook is intentionally not reactive to `currentArea` or `currentWeekOffset` beyond `weekOffset`. The search query, sidebar state, open modals, and panel state remain as ephemeral `useState` in `App.tsx` — those are transient UI session state, not navigation state.

---

### Step 3 — Refactor `App.tsx`

Replace the four navigation `useState` calls:

```ts
// Before
const [currentView, setCurrentView] = useState<AppView>('planner');
const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
const [selectedPlannerDate, setSelectedPlannerDate] = useState<string | null>(null);
const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
```

```ts
// After
const { view: currentView, projectId: selectedProjectId, dateStr: selectedPlannerDate, weekOffset: currentWeekOffset, navigate } = useAppLocation();
```

Update `handleViewSelect` and all call sites that directly call `setCurrentView`, `setSelectedProjectId`, `setSelectedPlannerDate`, or `setCurrentWeekOffset` to call `navigate(...)` instead.

The number of call sites is manageable:
- `handleViewSelect` (the main routing handler) — 1 site
- `shiftSelectedDay` — 1 site
- `setCurrentWeekOffset` inline calls in header chevron buttons — 2 sites
- Inline `setCurrentView('settings')` in sidebar — 1 site
- Keyboard shortcut handler cases (`t`, `,`, `8`, `1`–`7`) — already routed through `handleViewSelect`
- `onOpenProject` and `onOpenDay` callback props in `<PlannerView>` — 2 sites

Total refactor surface is small and mechanical.

---

### Step 4 — Vite dev server fallback (already fine)

Vite's dev server already serves `index.html` for all routes by default. Hash routing requires zero Vite config changes.

---

### Step 5 — Cloudflare Pages (already fine)

Cloudflare Pages serves `index.html` at the root `/`, and hash fragments are handled entirely by the browser — they are never sent to the server. No `_redirects` file is needed.

---

## What Survives a Page Refresh

| State | Persists after refresh? |
|---|---|
| Active view | ✅ (URL hash) |
| Selected project | ✅ (URL hash) |
| Selected day | ✅ (URL hash) |
| Week offset in planner | ✅ (URL hash) |
| Selected area filter | ❌ intentional — transient session state |
| Sidebar collapsed state | ❌ intentional — UI preference, not location |
| Open task modal | ❌ acceptable — deep-link to tasks is a separate, future improvement |
| Search query | ❌ intentional — cleared on refresh is standard behavior |

---

## What Does NOT Change

- The `useAppStore` Zustand store — all task/project/settings data already persists in `localStorage`
- All child components — they receive the same props as before; the refactor is contained entirely in `App.tsx` and two new files in `src/lib/`
- The `handleViewSelect` function signature — it continues to accept the same arguments
- The keyboard shortcut handler — shortcuts already call `handleViewSelect`, so they get URL persistence for free

---

## Implementation Order

1. `src/lib/routing.ts` — pure functions, unit-testable in isolation
2. `src/lib/useAppLocation.ts` — hook wrapping the pure functions
3. `App.tsx` — swap out the four `useState` calls and update the handful of direct setter call sites
4. Manual smoke test: navigate to each view type, press Refresh, confirm the location is restored

---

## Out of Scope (Future)

- **Deep-linking to a specific task** (e.g. `#task?id=abc123` → auto-opens the task modal). Useful but not critical for the "refresh sends me somewhere wrong" problem.
- **Path-based routing** (e.g. `/planner`, `/project/abc123`). Would require server config changes. Hash routing solves the UX problem completely.
- **Multi-panel state in the URL** — the split-panel feature (Shift+click) is a power-user feature; persisting multiple open panels in the URL is complex and not worth encoding.
