# Planetary Survey rollback

## Production pointer

**There is none.** Planetary Survey is not promoted.

- Game: `planetary-survey`
- Status: `coming-soon`
- Production version: _(none selected)_
- Production source SHA: _(none — no immutable release has been promoted)_
- Public play route: `/planetary-survey/play/` renders the shared unavailable panel
- Asset prefix: `/game-assets/planetary-survey/...` serves 404 for every version

This is the intended state until PS-PROMOTE (GAME-379) completes promotion. It also means
the production rollback for Planetary Survey is **a no-op**: there is no selected pointer
to restore, because none was ever set.

## Rollback that IS available today: retiring a qualification preview

A preview deployment is retired by removing its pointer, not by editing a database or
deleting objects:

1. unset `PLANETARY_SURVEY_PREVIEW_VERSION` on the preview environment (or delete the
   preview deployment);
2. redeploy, or let the environment recycle;
3. verify `/planetary-survey/play/` renders the unavailable panel with no iframe, and that
   `/planetary-survey/` shows no candidate pointer in its host-status block.

Removing the pointer restores the production behaviour exactly, because production never
set it. Nothing about the catalog changes, and no game artifact is touched.

## Immutable-object rule

Rollback never deletes or overwrites objects under `planetary-survey/<version>/`. A bad
candidate is abandoned by removing its pointer; it is never repaired in place. If a
candidate must be replaced, publish a new version.

This is the same rule the other games follow, and it is what makes a rollback target
verifiable rather than destructive.

## After promotion: the standard rollback

Once PS-PROMOTE has selected a production version, rollback follows the shared pattern
documented in [`game-release-contract.md`](game-release-contract.md): restore the previous
known-good games-site catalog revision (or revert the catalog pointer) and deploy that
revision. It never deletes or mutates the immutable R2 prefix.

A promotion must record, in this file, at minimum:

- production version and source SHA;
- immutable R2 prefix and entry file;
- games-site promotion SHA and the Pages deployment used;
- previous known-good deployment restore targets;
- the live readback checklist below, with observed results.

## Live readback checklist

Run against both the Pages hostname and `games.setnessconsulting.com`.

**Today (unpromoted) — expected results:**

1. `GET /planetary-survey/` → 200, shows a coming-soon launcher, host-status block reports
   `data-preview-pointer="none"`, and offers no "Play" action.
2. `GET /planetary-survey/play/` → 200, renders the shared unavailable panel, contains no
   iframe.
3. `GET /game-assets/planetary-survey/0.1.0/index.html` → 404 until a preview pointer
   approves that exact version.
4. The collection at `/` does not present Planetary Survey as playable.

**On a preview deployment (pointer set):**

1. `GET /planetary-survey/` → host-status block reports the exact candidate version and
   asset base.
2. `GET /planetary-survey/play/` → 200, iframe `src` is
   `/game-assets/planetary-survey/<candidate>/index.html`.
3. `GET` that asset → 200 with immutable cache headers and `x-content-type-options: nosniff`.
4. Nested hashed JS/CSS under that prefix → 200.
5. Direct navigation and refresh of the play route still load the same version.
6. Production is unchanged: re-checking the production hostname still reports
   `data-preview-pointer="none"` and no iframe.

**After promotion:** use the shared checklist in
[`weather-command-rollback.md`](weather-command-rollback.md#live-readback-checklist) with
the Planetary Survey routes and version substituted.
