# Self-Hosting (Cloudflare Pages Functions + D1)

## 1. Prerequisites
- Cloudflare account
- Node 20+
- `pnpm` installed
- Wrangler CLI (`npm i -g wrangler` or `pnpm dlx wrangler ...`)

## 2. Create D1 database
```bash
wrangler login
wrangler d1 create too-much-to-do
```

Copy the generated `database_id` into [worker/wrangler.toml](/home/vas/sites/node/toomuchtodo/worker/wrangler.toml).

## 3. Configure secrets
```bash
cp .dev.vars.example .dev.vars
# edit SESSION_SECRET / TURNSTILE settings
wrangler secret put SESSION_SECRET --config worker/wrangler.toml
wrangler secret put TURNSTILE_SECRET --config worker/wrangler.toml
```

## 4. Apply migrations
```bash
pnpm migrate:d1:local
wrangler d1 migrations apply too-much-to-do --remote --config worker/wrangler.toml
```

## 5. Local dev
```bash
pnpm dev
```

Set frontend API base URL only if you are also running the separate Worker locally:
```bash
# .env.local
VITE_API_BASE_URL=http://127.0.0.1:8787
```

For normal Pages Functions deployment, do not set `VITE_API_BASE_URL`. The app should call same-origin `/api/...`.

## 6. Deploy
```bash
pnpm build
# deploy dist/ to Cloudflare Pages with the `functions/` directory included
```

In the Cloudflare Pages project, add these bindings/variables for Functions:
- D1 binding: `DB`
- Secret: `SESSION_SECRET`
- Optional secret: `TURNSTILE_SECRET`
- Optional variable: `TURNSTILE_ENABLED=true`
- Optional variable: `APP_SCHEMA_LATEST=2`
- Optional variable: `APP_SCHEMA_MIN_SUPPORTED=2`
- Optional variable: `SESSION_COOKIE_NAME=tmtd_session`
- Optional variable: `SESSION_COOKIE_SAME_SITE=Lax`

If you previously set `VITE_API_BASE_URL` to `https://api.do.webme.ca` or any other external API origin, remove it from Pages and redeploy so the frontend falls back to same-origin `/api/...`.

## Notes
- Local-only mode still works with no account and no worker.
- Sync schema compatibility is enforced by `/api/sync/bootstrap` and `/api/sync/pull`.
- Same-origin Pages Functions avoids the CORS and cookie issues that come with a separate Worker hostname.

## Production verification checklist

Use a brand-new test account and verify the full same-origin Pages Functions path end to end:

1. **Bindings and secrets**
   - Confirm the Pages project has the `DB` D1 binding.
   - Confirm `SESSION_SECRET` is set.
   - If Turnstile is enabled, confirm `TURNSTILE_ENABLED=true`, `TURNSTILE_SECRET`, and `VITE_TURNSTILE_SITE_KEY` are all set consistently.
2. **Schema state**
   - Verify production D1 has applied all migrations.
   - Check `schema_meta` values match the currently deployed app schema.
3. **Cookie behavior**
   - Open the deployed app on the production origin.
   - Confirm sign-up/sign-in responses set the session cookie on the same origin.
   - Confirm `GET /api/auth/session` succeeds after sign-in.
4. **Clean-account sync smoke test**
   - Sign up with a never-before-used email address.
   - Run a first `bootstrap` and confirm the snapshot is empty for a fresh account.
   - On device A, create at least one task/project and run sync.
   - On device B, sign in with the same account and run `bootstrap` / `pull`.
   - Confirm device B receives the same data.
5. **Conflict smoke test**
   - Edit the same record on two signed-in devices.
   - Sync device A first, then sync device B.
   - Confirm device B surfaces a conflict outcome instead of silently overwriting.
6. **Diagnostics**
   - Copy the sync diagnostics block from Settings after a successful run.
   - If a request fails, confirm the diagnostics include the request ID, status code, server code, retry count, and stage.

## Troubleshooting

- If auth works locally but not in production, first inspect the session cookie on the deployed origin and confirm requests are still going to same-origin `/api/*`.
- If sync reports schema blocking, compare the deployed app build against `schema_meta` in production D1.
- If a retryable sync failure persists, use the Settings diagnostics export to capture the request ID and server code before investigating the Pages Functions logs.
