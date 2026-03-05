# Self-Hosting (Cloudflare Pages + Worker + D1)

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
pnpm dev:worker
# or run both
pnpm dev:all
```

Set frontend API base URL:
```bash
# .env.local
VITE_API_BASE_URL=http://127.0.0.1:8787
```

## 6. Deploy
```bash
wrangler deploy --config worker/wrangler.toml
pnpm build
# deploy dist/ to Cloudflare Pages
```

## Notes
- Local-only mode still works with no account and no worker.
- Sync schema compatibility is enforced by `/api/sync/bootstrap` and `/api/sync/pull`.
