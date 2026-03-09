# Sync Reliability Review and Next-Steps Plan

## Goal

Make the current same-origin Cloudflare Pages Functions auth + sync path dependable enough for real use before expanding scope further.

## Current Baseline

- Frontend deploy target: Cloudflare Pages on `do.webme.ca`
- Live backend target: Cloudflare Pages Functions under same-origin `/api/*`
- Shared backend code still lives in `worker/src/*` and is reused by Pages Functions
- Turnstile is now wired into the frontend auth form when `VITE_TURNSTILE_SITE_KEY` is present
- `pnpm build` succeeds
- There is still no automated test suite covering auth or sync

## Implementation Progress (Updated 2026-03-09)

### Phase 1 - Auth correctness and account isolation (Completed)

- Fixed Turnstile-enabled sign-up so the verified sign-up request now creates the session directly instead of recursively calling `signIn()` without the token.
- Added user-scoped composite keys for `tasks`, `projects`, `settings`, and `themes` via a new D1 migration, then updated the sync upsert paths to use `ON CONFLICT(user_id, id)`.
- Preserved stable `createdAt` values in auth session responses.

Nuance:
- Fresh installs still apply the original migrations first and then normalize to the user-scoped schema through the follow-up migrations.

### Phase 2 - End-to-end auth + sync coverage (Completed)

- Added a Node-based end-to-end test harness that exercises the live Pages Functions handler (`functions/api/[[route]].ts`) against a local SQLite-backed D1 shim.
- Added automated coverage for:
  - sign-up,
  - sign-in,
  - session refresh,
  - sign-out,
  - bootstrap,
  - push,
  - pull,
  - first-link upload,
  - two-client propagation,
  - same-record conflicts,
  - idempotent replay of the same push op ID.

Nuance:
- The environment here cannot run local `workerd` binaries because of a `glibc` mismatch, so the test harness uses Node's experimental `sqlite` module plus the real Pages Functions request handler instead of Wrangler-local runtime execution.

### Phase 3 - Concurrency semantics (Completed)

- Implemented optimistic concurrency on sync writes using `baseVersion` preconditions.
- Added per-record `syncVersion` tracking for tasks and projects plus a dedicated `settingsVersion` in sync metadata.
- Same-record concurrent edits now resolve with **server wins on conflict**:
  - the server rejects the stale write,
  - returns a structured conflict payload with the canonical server record,
  - the client applies that canonical server record locally and records the conflict details.
- Added `change_log.version` so pull responses can advance local entity versions correctly.

Nuance:
- Idempotent op replay is now part of the contract: reusing the same op ID is treated as an already-accepted write, which is what makes push retries safe.

### Phase 4 - Durable sync runs and diagnostics (Completed)

- Added sync-run serialization so overlapping manual/online sync triggers reuse the same in-flight promise.
- Sync no longer drops all context into a generic failure string; it now persists:
  - stage,
  - status code,
  - server code,
  - request ID,
  - retry count,
  - error message,
  - conflict count.
- Settings now exposes a richer diagnostics panel with copy/export actions.
- Sign-out now resets account-linked sync state instead of leaving the previous account's cursor and pending queue behind.

Nuance:
- Successful pushes are now safe to replay because the queue is only cleared after a successful pull and duplicate op IDs are deduped on the server.

### Phase 5 - Retry/backoff (Completed)

- Added capped client-side retry/backoff for sync `push` and `pull`.
- Retries are limited to retryable conditions (network failures, `429`, and `5xx` responses) and preserve request diagnostics.

Nuance:
- Auth endpoints intentionally do not auto-retry so sign-in and sign-up failures remain explicit to the user.

### Phase 6 - Production verification checklist (Prepared)

- Added a concrete Pages Functions production verification checklist to `docs/self-hosting.md`, including same-origin cookie checks, D1 schema checks, clean-account sync, conflict smoke testing, and diagnostics capture.

Nuance:
- The checklist is ready, but I could not execute the live production-account verification from this environment because deployment credentials/access are not available here.

### Phase 7 - Legacy hydration, background sync, and account UI polish (Completed)

- Added first-link merge behavior so a device can hydrate remote tasks/projects from an older account shape while still preserving local unsynced items.
- Added smart background sync triggers for:
  - immediate post-sign-in bootstrap/sync,
  - debounced local edits,
  - app focus regain,
  - browser reconnect.
- Replaced the oversized settings-only sync UI with a shared `AccountSyncPanel` that is now used both in Settings and in a new top-bar account/sync modal opened from an icon-only status entry.
- Strengthened password policy enforcement to require 12+ characters with upper/lower/number on both client guidance and backend sign-up validation.
- Extended automated coverage for weak-password rejection and first-link merge behavior.

Nuance:
- The shared panel keeps advanced diagnostics collapsed by default while leaving the user-facing actions visible, so the power-user tooling remains available without dominating the normal settings flow.

## Review Findings

### High Severity

- `signUp()` still breaks when Turnstile is enabled because it validates the incoming token, creates the user, then internally calls `signIn()` without forwarding `turnstileToken`. This can leave a newly created user unable to finish sign-in on the same request. See [worker/src/routes/auth.ts](/home/vas/sites/node/toomuchtodo/worker/src/routes/auth.ts#L73) and [worker/src/routes/auth.ts](/home/vas/sites/node/toomuchtodo/worker/src/routes/auth.ts#L91).
- The `settings` row is not safely user-scoped in practice. The table uses `id` as the primary key and sync writes always upsert `id = 'settings'`, so one user can overwrite another user’s settings record. See [worker/migrations/0001_initial.sql](/home/vas/sites/node/toomuchtodo/worker/migrations/0001_initial.sql#L44) and [worker/src/routes/sync.ts](/home/vas/sites/node/toomuchtodo/worker/src/routes/sync.ts#L111).
- Sync writes are not conflict-safe. `push()` ignores the client cursor entirely, applies each op directly, and returns placeholder conflict counts, so same-record concurrent edits are effectively arrival-order overwrites rather than a defined policy. See [worker/src/routes/sync.ts](/home/vas/sites/node/toomuchtodo/worker/src/routes/sync.ts#L201) and [worker/src/routes/sync.ts](/home/vas/sites/node/toomuchtodo/worker/src/routes/sync.ts#L220).

### Medium Severity

- Multi-op pushes are not transactional. A partial write can succeed before a later op fails, leaving client and server state diverged without an explicit recovery path. See [worker/src/routes/sync.ts](/home/vas/sites/node/toomuchtodo/worker/src/routes/sync.ts#L211).
- The client clears `pendingOps` immediately after push succeeds, before the follow-up pull completes. If pull then fails, the user loses visibility into what was sent and the sync cycle is left half-finished. See [src/lib/sync/engine.ts](/home/vas/sites/node/toomuchtodo/src/lib/sync/engine.ts#L77).
- `runSyncNow()` is not serialized, so manual sync and automatic online-triggered sync can overlap. See [src/store/useAppStore.ts](/home/vas/sites/node/toomuchtodo/src/store/useAppStore.ts#L298).
- Signing out leaves sync metadata intact, including cursor and pending ops, so a second account on the same browser profile can inherit stale sync state. See [src/store/useAppStore.ts](/home/vas/sites/node/toomuchtodo/src/store/useAppStore.ts#L276).
- The current operation model is too coarse for safe retries. Operations use random IDs and snapshot-like payload diffs with no base version or idempotency contract. See [src/lib/sync/operations.ts](/home/vas/sites/node/toomuchtodo/src/lib/sync/operations.ts#L3).

### Lower Severity But Worth Fixing

- Error handling is still too lossy for support. The UI receives generic failure strings without durable request diagnostics or retry classification. See [src/lib/sync/client.ts](/home/vas/sites/node/toomuchtodo/src/lib/sync/client.ts#L45), [src/lib/sync/engine.ts](/home/vas/sites/node/toomuchtodo/src/lib/sync/engine.ts#L83), and [src/store/useAppStore.ts](/home/vas/sites/node/toomuchtodo/src/store/useAppStore.ts#L302).
- Rate limiting is still in-memory per instance only, which is acceptable for v1 but not a dependable production control. See [worker/src/lib.ts](/home/vas/sites/node/toomuchtodo/worker/src/lib.ts#L113).
- The live Pages Functions router and the standalone Worker entrypoint still duplicate routing behavior, which creates drift risk. See [functions/_lib/backend.ts](/home/vas/sites/node/toomuchtodo/functions/_lib/backend.ts#L18) and [worker/src/index.ts](/home/vas/sites/node/toomuchtodo/worker/src/index.ts#L19).

## Recommended Priorities

## Priority 1: Fix auth correctness and account isolation first

### Deliverables

- Fix Turnstile-enabled sign-up so the same verified challenge can complete both user creation and session establishment.
- Fix the `settings` table/write path so settings are truly user-scoped.
- Review whether `tasks` and `projects` should remain globally unique IDs or move to a composite uniqueness model `(user_id, id)` for stronger guarantees.
- Add a migration plan for any schema changes required by the above.

### Acceptance Criteria

- Sign-up works with `TURNSTILE_ENABLED=true`.
- Two different accounts cannot overwrite each other’s settings.
- The schema isolation strategy is explicit and documented.

## Priority 2: Add end-to-end auth + sync coverage

### Why here

Until auth correctness and first-link sync are covered automatically, every deploy risks regressing the core account flow.

### Deliverables

- Add automated tests for:
  - sign-up,
  - sign-in,
  - session refresh,
  - sign-out,
  - bootstrap,
  - push,
  - pull,
  - first-link local data upload.
- Add at least one two-client scenario proving device A changes are visible on device B.
- Run tests against local Pages Functions + D1 local state.

### Acceptance Criteria

- A broken auth/bootstrap/push/pull flow is caught automatically.
- Turnstile-disabled and Turnstile-enabled auth paths are both covered.

## Priority 3: Define and enforce concurrency semantics

### Recommendation

Pick one explicit v1 policy and implement it consistently:

1. Preferred: optimistic concurrency with a base version / precondition on every write.
2. Acceptable v1 fallback: true LWW using `updated_at` plus deterministic tie-break rules.

Current behavior should not remain implicit arrival-order overwrite.

### Deliverables

- Add base version or equivalent precondition metadata to sync ops.
- Make `push()` validate the precondition or enforce a documented LWW rule.
- Return real conflict counts and structured conflict outcomes.
- Document the policy in code and docs.

### Acceptance Criteria

- Two devices editing the same record follow one explicit rule.
- Conflict outcomes are measurable and test-covered.

## Priority 4: Make sync runs durable and diagnosable

### Deliverables

- Add per-run serialization so only one sync run can execute at a time.
- Keep enough state after push to recover cleanly if pull fails.
- Persist last sync diagnostics:
  - stage,
  - status code,
  - server code,
  - request ID if available,
  - retry count,
  - last error message.
- Expand the Settings diagnostics surface to show the last sync attempt and allow copy/export of diagnostics.

### Acceptance Criteria

- Overlapping sync runs cannot race.
- A failed pull after a successful push is visible and recoverable.
- Support/debug information survives reloads.

## Priority 5: Add retry/backoff only after idempotency is safe

### Deliverables

- Add capped exponential backoff with jitter for retryable failures only.
- Retry only on network failures, 5xx, 429, or explicit retryable server responses.
- Do not retry validation, auth, or schema mismatch failures.
- Make push retries idempotent-safe before enabling them.

### Acceptance Criteria

- Short outages do not immediately fail the whole sync flow.
- Retries do not duplicate writes or corrupt server state.

## Priority 6: Add a production verification checklist

### Deliverables

- Document and run a clean-account smoke test for Pages Functions:
  - `DB` binding present,
  - `SESSION_SECRET` set,
  - optional Turnstile vars set correctly,
  - same-origin cookie set/read works,
  - `schema_meta` is correct in production D1,
  - new account can sign up,
  - device A creates data and syncs,
  - device B signs in and pulls the same data.
- Record the expected outputs and troubleshooting steps.

### Acceptance Criteria

- Production readiness is verified by execution, not assumed from dashboard config.

## Suggested Order

1. Fix Turnstile sign-up correctness and settings isolation.
2. Add auth + sync E2E coverage.
3. Define and implement explicit concurrency behavior.
4. Add sync serialization and durable diagnostics.
5. Add safe retry/backoff.
6. Capture and follow a production verification checklist.

## Notes

- Pages Functions is now the primary deployment story. Same-origin `/api/*` should remain the default recommendation.
- The standalone Worker path is still useful for migrations and shared backend code, but it should not drive product-facing deployment guidance.
