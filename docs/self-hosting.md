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
