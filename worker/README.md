# too-much-to-do worker

## Local run
```bash
wrangler dev --config worker/wrangler.toml
```

## Apply D1 migrations
```bash
wrangler d1 migrations apply too-much-to-do --local --config worker/wrangler.toml
wrangler d1 migrations apply too-much-to-do --remote --config worker/wrangler.toml
```

Always run the remote migration command after deploying worker/schema changes. The sync API now auto-provisions optional plugin tables (for example `day_goals`) as a safety net, but migrations are still the source of truth for production schema evolution.
