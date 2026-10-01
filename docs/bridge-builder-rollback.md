# Bridge Builder — Live Rollback Rehearsal

Recorded 2026-09-27 (owner-approved) for the Bridge Builder production release.

## Current pointer

Production now selects immutable R2 `bridge-builder/0.1.0-qualification.14/`
(manifest commit `9b4fdb0f0826ab893c9b70b0a50ce1b9521cdb89`), promoted
2026-10-01 for the GAME-297 reduced-motion success-payoff fix.

### How a rollback actually works

`/game-assets/...` does **not** serve every published object. `isApprovedRelease`
in `src/lib/game-assets.ts` approves only the exact versions the catalog and the
deployment pointers name, so while the pointer reads `.14`, requests for
`.13/index.html` and `.13/release-manifest.json` return **404** — verified live
after this promotion.

The rollback target is therefore two things together:

1. the immutable `.13` artifact, still present and untouched in private R2
   (re-read successfully on 2026-10-01), and
2. a revert of the games-site pointer commit, which re-approves `.13` and makes
   it reachable again.

That is exactly the mechanism the `.13 → .12 → .13` rehearsal below exercised: a
pointer move, never a re-publish or an overwrite. `0.1.0-qualification.12/` is
retained the same way as the older rehearsal target.

## Rehearsed release and targets

- Promoted candidate: immutable R2 `bridge-builder/0.1.0-qualification.13/`
  (manifest commit `3f33896399e7c555bb80b71cde454cf8bb51b612`, production Pages
  deploy `c4c76c00-9d2b-436c-bbee-4ae750302e98` for games-site commit `00b2873`).
- Rollback target: the still-published immutable R2
  `bridge-builder/0.1.0-qualification.12/` candidate.
- The rehearsal moves only the committed catalog pointer
  (`BRIDGE_BUILDER_PRODUCTION_VERSION` in `src/data/games.ts`); both immutable
  candidates stay published throughout.

## Rehearsal sequence

1. Baseline: `https://games.setnessconsulting.com/bridge-builder/play/` served
   `0.1.0-qualification.13` (iframe `src` readback; deploy `c4c76c00`).
2. PR #40 (branch `rehearsal/bridge-builder-rollback-20260927`, head `bf378f8`,
   merge `86d0cd6`) reverted the committed pointer to `0.1.0-qualification.12`.
   Local `npm run verify` passed (19 files, 173 tests) before merge; hosted
   `verify` and the Cloudflare Pages check were green on the head.
3. Production readback after that merge: Pages deploy
   `0b184e78-11d6-4697-9b96-3cd73639d13f` served `.12`. Playwright verified on
   both the Pages hostname and the custom domain:
   - `/bridge-builder/play/` returned `200` and the frame pointed at
     `/game-assets/bridge-builder/0.1.0-qualification.12/index.html`;
   - the game itself loaded and ran (`Canvas ready`, DOM mirror visible);
   - the GPSDK handshake status region announced
     `The game platform connection has not been established.` — the graceful
     timeout, never `Game connection ready.` (`.12` carries no guest SDK
     transport);
   - `/game-assets/bridge-builder/0.1.0-qualification.12/index.html` returned
     `200` with an `immutable` cache header.
4. PR #41 (head `64a482f`, merge `68828d0`) restored the committed pointer to
   `0.1.0-qualification.13` by reverting the rehearsal revert. Local
   `npm run verify` passed (19 files, 173 tests); hosted checks green on the
   head.
5. Production readback after the restore: Pages deploy
   `241956df-b491-49d5-bddc-9eecf033f397` served `.13` again. The hosted
   games-site e2e qualification passed against production: the frame points at
   `.13`, the status region reaches `Game connection ready.`, and the served
   assets hash-verify against the immutable release manifest.

## Result

Rollback `.13` → `.12` and forward again are both production-verified. The
rollback target loads and plays with the graceful timeout announcement; the
promoted candidate completes the GPSDK handshake. Production is left on
`0.1.0-qualification.13`.

## Boundary

Operational catalog-pointer rollback and restore only. No R2 object was
deleted, overwritten, or republished; no game source or immutable release
artifact changed; `.12` remains published as the rollback target.
