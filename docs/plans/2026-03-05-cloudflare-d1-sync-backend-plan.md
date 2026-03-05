# Cloudflare D1 Backend + Cross-Device Sync Plan

## Goal

Add a Cloudflare-hosted backend that enables secure cross-device sync while preserving a full no-account local mode, with automatic schema migrations for both cloud data (D1) and local storage.

## Date

- Prepared: 2026-03-05

## Implementation Progress (Updated: 2026-03-05)

### Milestone 1 - Phase 1 Foundations (Completed)

- Added `updatedAt` / `deletedAt` to `Task` and `Project` models in [src/types.ts](/home/vas/sites/node/toomuchtodo/src/types.ts).
- Added local schema migration pipeline + envelope versioning in:
  - [src/store/storage/migrations.ts](/home/vas/sites/node/toomuchtodo/src/store/storage/migrations.ts)
  - [src/store/storage/localDriver.ts](/home/vas/sites/node/toomuchtodo/src/store/storage/localDriver.ts)
- Refactored store persistence into driver boundary and wired sync metadata (`deviceId`, `syncCursor`, `pendingOps`, `localSchemaVersion`) in [src/store/useAppStore.ts](/home/vas/sites/node/toomuchtodo/src/store/useAppStore.ts).
- Preserved local-only UX as default mode.

Nuance:
- Existing delete behavior remains hard-delete in UI state for now; tombstones are represented in sync operations and cloud schema.

### Milestone 2 - Phase 2 Worker + D1 Skeleton (Completed)

- Added Worker project + Wrangler config:
  - [worker/wrangler.toml](/home/vas/sites/node/toomuchtodo/worker/wrangler.toml)
  - [worker/src/index.ts](/home/vas/sites/node/toomuchtodo/worker/src/index.ts)
- Added D1 migrations:
  - [worker/migrations/0001_initial.sql](/home/vas/sites/node/toomuchtodo/worker/migrations/0001_initial.sql)
  - [worker/migrations/0002_schema_defaults.sql](/home/vas/sites/node/toomuchtodo/worker/migrations/0002_schema_defaults.sql)
- Added typed schema helper in [worker/src/db/schema.ts](/home/vas/sites/node/toomuchtodo/worker/src/db/schema.ts).

Nuance:
- Worker routing is intentionally minimal (no external framework) to keep self-host setup lean.

### Milestone 3 - Phase 3 Auth (Completed)

- Implemented auth routes in [worker/src/routes/auth.ts](/home/vas/sites/node/toomuchtodo/worker/src/routes/auth.ts):
  - `POST /api/auth/sign-up`
  - `POST /api/auth/sign-in`
  - `POST /api/auth/sign-out`
  - `GET /api/auth/session`
- Added secure cookie handling (`HttpOnly`, `Secure`, `SameSite=Lax`) and session persistence in D1.
- Added frontend auth client + settings entry points:
  - [src/lib/sync/authClient.ts](/home/vas/sites/node/toomuchtodo/src/lib/sync/authClient.ts)
  - [src/features/settings/SettingsView.tsx](/home/vas/sites/node/toomuchtodo/src/features/settings/SettingsView.tsx)

Nuance:
- Auth implementation is currently custom session-based and interface-compatible with later Better Auth swap-in.

### Milestone 4 - Phase 4 Sync v1 (Completed)

- Implemented sync endpoints:
  - `GET /api/sync/bootstrap`
  - `POST /api/sync/push`
  - `GET /api/sync/pull`
- Added client sync plumbing:
  - [src/lib/sync/client.ts](/home/vas/sites/node/toomuchtodo/src/lib/sync/client.ts)
  - [src/lib/sync/engine.ts](/home/vas/sites/node/toomuchtodo/src/lib/sync/engine.ts)
  - [src/lib/sync/operations.ts](/home/vas/sites/node/toomuchtodo/src/lib/sync/operations.ts)
- Added guest->account initial merge strategy (`local_wins_first_link`) via initial op queueing.
- Added online reconnect sync trigger and manual sync controls in Settings.

Nuance:
- Conflict handling is currently LWW with conflict count placeholder (`0`) and can be extended with richer reconciliation stats.

### Milestone 5 - Phase 5 Migrations + Resiliency (Completed)

- Added client/server schema handshake in `bootstrap` and `pull` responses and enforced client schema block (`schemaBlocked`) in sync meta.
- Added local deterministic migration pipeline (`v1 -> v2`) with persisted `localSchemaVersion`.
- Added D1 migration command wiring in [package.json](/home/vas/sites/node/toomuchtodo/package.json).
- Added D1 migration check workflow in [.github/workflows/d1-migrations-check.yml](/home/vas/sites/node/toomuchtodo/.github/workflows/d1-migrations-check.yml).

Nuance:
- Workflow validates migration discovery/parsing and frontend build; it can be extended with remote apply smoke checks in environments with Cloudflare credentials.

### Milestone 6 - Phase 6 Security + Observability (Completed)

- Added route-level rate limiting for auth/sync writes.
- Added same-origin check for mutation requests.
- Added optional Turnstile validation gate (env-controlled).
- Added audit events for sign-up/sign-in in `audit_events`.
- Exposed client-side sync observability in Settings (mode, pending ops, last sync, schema block flag).

Nuance:
- Rate limiter is in-memory per Worker instance (good baseline; move to durable backing for stronger global limits at scale).

## Current App Baseline (What Exists)

- App is a Vite + React SPA with no backend.
- Persistence is local-only via `localStorage` in [`src/store/useAppStore.ts`](/home/vas/sites/node/toomuchtodo/src/store/useAppStore.ts).
- A single state blob (`AppStateData`) is stored under `too_much_to_do_state_v1`.
- There is no auth, no cloud identity, and no sync metadata (no `updatedAt`, `deletedAt`, `deviceId`, etc.).

## Constraints You Asked For

- Setup must be easy for self-hosters.
- Secure authorization and sign-in.
- Continue using app with no account (local-only mode).
- Schema changes must auto-sync/auto-migrate both D1 and local data.

## Recommended Architecture (Opinionated)

## Stack

1. Frontend: keep existing Vite React app.
2. Backend API: Cloudflare Worker (Hono or minimal router).
3. Database: Cloudflare D1 (single DB initially).
4. Auth: Better Auth running in Worker, stored in D1.
5. Deploy: Cloudflare Pages for frontend + Worker API on subpath/domain.

Why this shape:

- Lowest ops burden for hosting.
- D1 + Worker is first-party and deployment is simple.
- Better Auth currently supports D1 directly, reducing adapter complexity.
- Preserves local-first UX with optional cloud account.

## Product Modes

1. `local` mode (default):
- No account required.
- All CRUD stays local.
- Sync engine disabled.

2. `account` mode:
- User signs in.
- Local state migrates into sync model.
- Bi-directional sync with D1.

3. `account + offline` mode:
- Same as account mode, but writes queue locally when offline.
- Background/foreground sync flushes queue on reconnect.

## Data Model Plan

Move away from “single giant state blob” for sync. Use per-entity rows + tombstones.

## D1 tables

- `users` (auth user record via Better Auth)
- `sessions` (auth sessions via Better Auth)
- `devices`
- `projects`
- `tasks`
- `settings`
- `themes` (optional: only custom themes)
- `change_log` (append-only sync feed)
- `schema_meta` (app schema version)

## Core sync columns per entity

- `id TEXT PRIMARY KEY`
- `user_id TEXT NOT NULL`
- `updated_at INTEGER NOT NULL` (unix ms)
- `deleted_at INTEGER NULL` (tombstone)
- `version INTEGER NOT NULL DEFAULT 1` (optimistic conflict checks)
- entity fields (task title/status/etc.)

## Important indexes

- `(user_id, updated_at)` on each sync table
- `(user_id, deleted_at)`
- `(user_id, due_date)` for task querying
- `(user_id, project_id)` for task/project filtering

## API + Sync Protocol

Use a simple push/pull protocol with cursor.

## Endpoints

- `POST /api/auth/*` (handled by Better Auth)
- `GET /api/sync/bootstrap`
- `POST /api/sync/push`
- `GET /api/sync/pull?cursor=<token>`
- `POST /api/sync/ack` (optional if cursor in pull response is enough)

## Client sync metadata (local)

- `deviceId`
- `syncCursor`
- `lastSyncAt`
- `pendingOps[]`
- `localSchemaVersion`
- `cloudLinked` boolean

## Conflict strategy (v1)

- Last-write-wins by `updated_at` per record.
- Preserve deletions via tombstones (`deleted_at`).
- For same timestamp edge-case: tie-break by `device_id` lexical order.
- Return conflict stats in API response for observability.

## Guest -> Account merge flow

1. User signs in.
2. Client sends current local dataset as first `push` with `mergeStrategy`.
3. Server upserts records for that `user_id`.
4. Server returns canonical cloud snapshot + cursor.
5. Client rewrites local normalized store and switches to synced mode.

Default merge strategy recommendation: `local_wins_first_link`.

## Auth & Security Plan

## Authentication

- Better Auth in Worker with D1-backed users/sessions.
- Prefer secure session cookies (HttpOnly, Secure, SameSite=Lax/Strict).
- Add OAuth provider(s) later (Google/GitHub) after email/passkey baseline.

## Authorization

- Every sync query must filter by authenticated `user_id`.
- Never accept `user_id` from client payload.
- Device registration tied to session user.

## Hardening

- Cloudflare Turnstile on sign-up/sign-in sensitive flows.
- Rate limit auth and sync write endpoints.
- Use prepared statements only.
- Add audit events for login, link-device, merge, bulk delete.

## Local-First Storage Refactor

Current store writes full app blob. For sync, introduce a storage adapter layer.

## New abstraction

- `StorageDriver` interface:
  - `loadState()`
  - `savePatch()`
  - `runMigrations()`
  - `getSyncMeta()` / `setSyncMeta()`

Implementations:

- `LocalOnlyDriver` (always localStorage)
- `SyncedDriver` (local cache + sync engine)

## Minimal first migration in app code

- Add `updatedAt`, `deletedAt` to `Task` and `Project` models.
- Keep compatibility by normalizing older records in existing `normalizeTask`/`normalizeProject`.
- Continue rendering from local cache; backend is eventually consistent layer.

## Schema Migration Plan (Cloud + Local)

## Cloud (D1)

- Use Wrangler D1 SQL migrations (`migrations/` folder).
- Keep migrations additive when possible.
- Record applied migrations in D1 migration table.

## Local

- Add `localSchemaVersion` in local persisted payload.
- Maintain deterministic migration pipeline:
  - `migrateV1toV2`
  - `migrateV2toV3`
  - etc.
- Run on app boot before store initialization.

## Compatibility contract

- API includes `minSupportedClientSchema` and `latestSchema`.
- If client too old:
  - run local migrators automatically if available.
  - if not possible, show blocking upgrade message.

## Deployment and Self-Host Simplicity

## Repository layout to add

- `worker/` (API + auth + sync service)
- `worker/src/routes/*`
- `worker/src/db/*`
- `worker/migrations/*.sql`
- `wrangler.toml`
- `.dev.vars.example`

## One-command local dev target

- `pnpm dev` runs Vite
- `pnpm dev:worker` runs Wrangler
- `pnpm dev:all` runs both

## Self-host setup script/docs

- `docs/self-hosting.md` with:
  - Cloudflare account creation
  - `wrangler login`
  - `wrangler d1 create`
  - set secrets
  - deploy commands

## Step-by-Step Delivery Plan

## Phase 1: Foundations

- Add normalized entity timestamps (`updatedAt`, `deletedAt`) to local models.
- Add storage adapter boundary around current store persistence.
- Add sync metadata keys in local storage.

Exit criteria:

- App behavior unchanged in local-only mode.
- Existing users auto-migrate without data loss.

## Phase 2: Worker + D1 skeleton

- Create Worker project with health endpoint.
- Create initial D1 schema and migrations.
- Add typed DB access helpers and validation.

Exit criteria:

- Local dev can query D1 through Worker.

## Phase 3: Auth

- Integrate Better Auth routes.
- Add session cookie config and CSRF protection approach.
- Add basic sign-up/sign-in UI entry points in app.

Exit criteria:

- User can sign in and obtain authenticated session.

## Phase 4: Sync v1

- Implement `/sync/bootstrap`, `/sync/push`, `/sync/pull`.
- Add client sync engine with retry/backoff and offline queue.
- Implement initial guest->account merge flow.

Exit criteria:

- Two devices on same account converge to same task/project state.
- Offline edits sync after reconnect.

## Phase 5: Migrations and resiliency

- Add schema-version handshake between client/server.
- Add automated local migration tests.
- Add D1 migration CI check (apply on ephemeral/local DB).

Exit criteria:

- Version upgrade path validated for both local and cloud data.

## Phase 6: Security + observability

- Add rate limiting + Turnstile.
- Add sync metrics (queue size, pull lag, conflict counts).
- Add audit logging for sensitive account events.

Exit criteria:

- Auth and sync abuse surface reduced.
- Operational visibility exists for debugging.

## Testing Plan

- Unit tests:
  - local migration functions
  - conflict resolution logic
  - payload validation
- Integration tests:
  - push then pull convergence
  - tombstone propagation
  - guest->account merge behavior
- E2E:
  - create tasks offline on device A, reconnect, see on device B
  - schema upgrade with old local payload

## Risks and Mitigations

- D1 single-threaded write path can bottleneck:
  - keep writes small/batched; avoid large transaction blocks.
- Conflict surprises for users:
  - expose “recently changed on another device” hints later.
- Local storage size limits:
  - move cache to IndexedDB if task volume grows.
- Auth vendor churn:
  - keep auth behind `AuthService` interface.

## Decisions to Lock Early

1. Auth method in v1:
- Recommended: email magic link + passkey optional.

2. Conflict policy:
- Recommended: LWW + tombstones for v1, CRDT deferred.

3. Local persistence medium:
- Recommended: keep `localStorage` for v1; migrate to IndexedDB only if needed.

## Practical MVP Scope (Fastest Safe Path)

1. Keep current UI and store mostly intact.
2. Add metadata fields and sync adapter.
3. Add Worker + D1 + Better Auth.
4. Sync only `tasks`, `projects`, `settings` in v1.
5. Leave timer/session ephemeral local until v2.

## Research Notes (validated)

- D1 migrations and migration table support are documented in Cloudflare D1 docs.
- D1 is single-threaded per DB instance; throughput depends heavily on query time.
- D1 `batch()` provides transactional batch behavior.
- D1 read replication requires Sessions API for sequential consistency.
- Better Auth recently added direct D1 support (per official changelog).

## Suggested immediate next implementation ticket

- "Introduce storage/sync abstraction and add `updatedAt`/`deletedAt` fields to local models with backward-compatible migration in `useAppStore.ts`."

## Current Status

- Implementation status: completed on 2026-03-05.
- Remaining follow-up (optional hardening): swap custom auth implementation to Better Auth routes/adapters if required by deployment preference.
