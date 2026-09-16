# Deployment checklist

## Pages

The existing Cloudflare Pages project is `games-site`, connected to the `setnessconsulting/games-site`
repository.

Configure:

- Production branch: `main`
- Build command: `npm ci && npm run build`
- Output directory: `dist`
- Node version: `24` from `.node-version`
- Custom domain: `games.setnessconsulting.com`
- Web Analytics: enabled from the Pages project Metrics settings

Cloudflare Git integration creates previews for branches and deploys `main` to production.

## R2

Create a dedicated private bucket named `setnessconsulting-games`. Do not reuse unrelated private
artifact buckets.

Bind it to the Pages project as `GAME_ASSETS` in both preview and production. The binding is also
recorded in `wrangler.jsonc` for local validation.

For local fixture testing, upload the files in `fixtures/webgl-smoke/Build/` under:

```text
test-fixture/0.0.0/Build/
```

Enable `GAME_ASSETS_ENABLE_FIXTURE=true` only in local or staging environments.

## Secrets

The game repository's release workflow will need a narrowly scoped Cloudflare credential that can
write objects to the game-build bucket and a GitHub credential that can open a pull request against
this repository. Keep both in GitHub Actions secrets; never place them in source or `wrangler.jsonc`.

## Domain timing

The custom domain can be validated on the Pages hostname before the planned nameserver transfer.
After DNS authority moves to Cloudflare, verify:

- `https://games.setnessconsulting.com/`
- `https://games.setnessconsulting.com/signal-garden/`
- `https://games.setnessconsulting.com/game-assets/...`
