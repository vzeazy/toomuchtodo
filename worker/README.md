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
