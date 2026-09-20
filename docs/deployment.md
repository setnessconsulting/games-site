# Deployment checklist

## Pages

The existing Cloudflare Pages project is `games-site`, connected to the `setnessconsulting/games-site`
repository.

Configure:

- Production branch: `main`
- Build command: `npm run build`
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

For a Bridge Builder hosted qualification preview, publish the immutable static release from the
standalone game repository under `bridge-builder/<version>/`, then build a non-production Pages
preview with `BRIDGE_BUILDER_PREVIEW_VERSION=<version>`. This opt-in pointer makes
`/bridge-builder/play/` load the exact versioned `index.html` through the same-origin R2 function;
the same variable is supplied to the preview Function so the version is approved for reads. The
approved production version is pinned directly in `src/data/games.ts`; do not use the preview
variable as the production release pointer.

For a Math Detective hosted qualification preview, publish the immutable static release from the
standalone game repository under `math-detective/<version>/`, then build a non-production Pages
preview with `MATH_DETECTIVE_PREVIEW_VERSION=<version>`. The production catalog remains
`coming-soon` until the single-tester live-child, device, performance, authored-presentation,
rollback, and named approval gates are complete. The live-child gate is the owner-run qualitative
protocol in the standalone repository's `PLAYTEST_PROTOCOL.md`; it intentionally requires one
tester and does not claim statistically representative usability.

The current candidate completed the promotion path on 2026-09-20. The active production catalog
selects `math-detective/2026.09.20-visual-pass.1/`; the previous known-good Pages deployment
`50118dc5.games-site-7pn.pages.dev` remains available as the rollback target and was verified to
serve the prior `coming-soon` state. This read-only target verification does not claim that a live
production rollback drill has been exercised.

For a Number Line Jumper release, publish the immutable static build from
`setnessconsulting/game-number-line-jumper` under `number-line-jumper/<version>/`, then update the
checked-in production pointer in `src/data/games.ts` and deploy `main`. The current production
version is `main-12641c0`. A non-production Pages preview may override it with
`NUMBER_LINE_JUMPER_PREVIEW_VERSION=<version>`; the same exact pointer must be supplied to the
preview Function. Rollback changes only the checked-in production pointer to a previously published
immutable version. Do not overwrite or delete published prefixes. The 2026-09-20 rehearsal is
recorded in [`number-line-jumper-rollback.md`](number-line-jumper-rollback.md).

## Secrets

The game repository's release workflow will need a narrowly scoped Cloudflare credential that can
write objects to the game-build bucket and a GitHub credential that can open a pull request against
this repository. Keep both in GitHub Actions secrets; never place them in source or `wrangler.jsonc`.

## Domain timing

The custom domain can be validated on the Pages hostname before the planned nameserver transfer.
After DNS authority moves to Cloudflare, verify:

- `https://games.setnessconsulting.com/`
- `https://games.setnessconsulting.com/signal-garden/`
- the preview URL for `/bridge-builder/` and `/bridge-builder/play/` when a candidate branch is enabled
- `https://games.setnessconsulting.com/game-assets/...`
