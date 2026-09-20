# Number Line Jumper — Rollback Rehearsal

Recorded 2026-09-20 for GAME-293.

## Immutable releases

- Current accepted candidate: `number-line-jumper/main-12641c0/`.
- Reversible rollback target: `number-line-jumper/pr8-c7428853083f/`.
- No object was deleted, overwritten, or republished during the rehearsal.

## Rehearsal sequence

1. PR [#12](https://github.com/setnessconsulting/games-site/pull/12) changed
   only `NUMBER_LINE_JUMPER_PRODUCTION_VERSION` to
   `pr8-c7428853083f`. It merged as
   [`a3b5bd8`](https://github.com/setnessconsulting/games-site/commit/a3b5bd8ed486347bc93c503206a3e1f1bdd623aa)
   after site verification and the Cloudflare Pages check passed.
2. Production readback on both the Pages hostname and the custom domain
   confirmed the collection card remained playable and
   `/number-line-jumper/play/` loaded the old immutable prefix.
3. The rollback asset route returned `200 text/html` for `index.html` and
   `200` with JavaScript/CSS content types for the referenced assets. An
   invalid nested asset path returned `404`; the immutable prefix was not
   broadened.
4. This restoration change returns the checked-in production pointer to
   `main-12641c0`. After it is merged, repeat the same live readback and
   record the resulting games-site merge SHA in the GAME-224 manifest.

## Boundary

This is an operational rollback check for the games-site catalog. It does not
promote a new game artifact, change preview variables, add LevelBest runtime
integration, or alter the immutable R2 objects.
