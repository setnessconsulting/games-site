# Planetary Survey host contract

Status: established by GAME-365 / PS-HOST
Game repository: `setnessconsulting/Game-Planetary-Survey`
Jira: GAME-362 (Epic), GAME-365 (PS-HOST), promotion owned by GAME-379 (PS-PROMOTE)

This document is the host target for Planetary Survey. It exists so the game repository
can build against a known contract without coupling itself to games-site internals, and
so **production stays unavailable until promotion**.

> **Nothing is promoted.** Planetary Survey has no production release, no
> `PLANETARY_SURVEY_PRODUCTION_VERSION`, and no `release` in the catalog. The catalog
> entry is `coming-soon`. That is the current, intended state, not an oversight.

---

## 1. Host identity

| Fact             | Value                                              |
| ---------------- | -------------------------------------------------- |
| Slug             | `planetary-survey`                                 |
| Release kind     | `static-web` (planned; not yet selected)           |
| Index route      | `/planetary-survey/`                               |
| Play route       | `/planetary-survey/play/`                          |
| Asset base       | `/game-assets/planetary-survey/<version>/`         |
| R2 object prefix | `planetary-survey/<version>/`                      |
| Entry document   | `index.html`                                       |
| Release manifest | `planetary-survey/<version>/release-manifest.json` |

`<version>` is an immutable, path-safe identifier. The game repository's
`npm run build:nested` derives that prefix from its own package version, and its
`npm run release:manifest` writes the manifest that records the source SHA, lockfile
identity, per-file hashes, and the catalogue source register version.

### Base path expectations

The artifact must resolve every referenced file relative to the supplied versioned
asset base and must never assume domain-root deployment. This is enforced on the game
side by `tests/host/nestedAssetBase.spec.ts`, which serves the build beneath the exact
prefix above and fails if any request escapes it.

### Cache and security expectations

Assets are served by the Pages Function under `functions/game-assets/` with:

- immutable cache headers (`public, max-age=31536000, immutable`);
- `X-Content-Type-Options: nosniff`;
- document CSP and `X-Frame-Options: SAMEORIGIN` for HTML documents, so the same-origin
  play iframe works while cross-origin embedding is refused.

Objects below a published `<slug>/<version>/` prefix are immutable. Rebuilds use a new
version; they never overwrite an accepted one.

---

## 2. Two pointers, deliberately different types

The catalog distinguishes two things that must never be confused:

|                          | `release`                                               | `preview`                                                                 |
| ------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| Means                    | "the catalog promotes this exact version to production" | "a hosted qualification candidate exists, and production must not use it" |
| Type                     | `GameRelease` (`kind` + version + files)                | `GamePreview` (`version` + `entryFile`)                                   |
| Allowed on `coming-soon` | **no** — validation rejects it                          | yes                                                                       |
| Allowed on `playable`    | required                                                | **no** — validation rejects it                                            |
| Read by                  | `getStaticWebPlaySource`                                | `getGamePreviewSource`                                                    |
| Populated by             | a reviewed catalog promotion                            | `PLANETARY_SURVEY_PREVIEW_VERSION` on the deployment                      |

They are separate types on purpose. If they shared a shape, some future edit would
promote a candidate by copying the wrong field. The validator rejects every combination
that would blur them:

- a `playable` entry carrying a preview pointer;
- an entry carrying both a `release` and a `preview`;
- a `coming-soon` entry carrying a `release`;
- `previewEnabled` on a `playable` entry.

**Why this is better than reusing the older `*_PREVIEW_VERSION` mechanism.** For the six
promoted games, that mechanism swaps the _production_ version of an entry that is already
`playable`. Applying it to an unreleased game would require flipping `status` to
`playable` first — meaning the promotion and the qualification preview become the same
change, and a mistaken merge promotes an unqualified build. Here the entry stays
`coming-soon` in every environment; only the presence of a preview pointer changes, and
that pointer can never be read as production.

---

## 3. Preview behaviour

`PLANETARY_SURVEY_PREVIEW_VERSION` is a **preview-only** exact-version override.

| Environment             | Variable                | Result                                                                                                                                    |
| ----------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Production              | unset                   | no pointer of any kind; `/planetary-survey/play/` renders the shared unavailable panel; the collection does not link the game             |
| Preview / qualification | set to an exact version | that version is the candidate asset base; the launcher offers "Open the qualification preview"; the play route frames the exact candidate |

Preview behaviour is intentionally explicit rather than automatic:

- the launcher label says **qualification preview**, never "Play";
- the launcher page renders a machine-readable host-status block
  (`data-slot="planetary-survey-host-status"` with `data-catalog-status`,
  `data-preview-pointer`, `data-preview-asset-base`) so a real build's real state can be
  asserted, rather than trusting this prose;
- asset serving still requires an exact match. `isApprovedRelease` cannot approve
  Planetary Survey through its catalog fallback, because the catalog promotes nothing —
  only a deployment-supplied pointer can approve an asset, and only for that exact
  version. A deployment that forgets the pointer serves 404s rather than serving an
  unqualified candidate.

`previewEnabled: true` on the entry is what permits the play route to exist for a
`coming-soon` game. It is a reviewable source statement, not an environment check, so
production and preview validate identically. Route validation additionally fails if
`previewEnabled` is declared without a matching play page, and still fails if a
`coming-soon` game exposes a play page without opting in.

---

## 4. Promotion (not done here, owned by PS-PROMOTE)

Promotion is a reviewed catalog change in this repository:

1. confirm the immutable candidate passes its science, accessibility, comparator, device,
   rollback, provenance, and playtest gates (GAME-379 / PS-PROMOTE);
2. add `PLANETARY_SURVEY_PRODUCTION_VERSION` and select the exact immutable release;
3. change the entry from `coming-soon` to `playable`, removing the preview pointer;
4. pass repository CI and hosted preview qualification;
5. merge. The merge commit is the production promotion identity.

Until step 5 lands, no Planetary Survey build is reachable in production, and the entry
must remain `coming-soon`.

---

## 5. Coupling boundary

games-site owns presentation, the selected version pointer, promotion, and rollback.
The game repository owns its source, tests, build, and immutable release identity.

The game must not depend on games-site internals, and this repository must not depend on
the game's internals: the contract between them is the versioned prefix, the entry
document, the release manifest, and the cache/security headers above. Nothing in the
game imports a games-site module, and nothing here imports a game module.

---

## 6. What the tests actually prove

`test/planetary-survey.test.ts` asserts, in both environment states:

- **production selects nothing** — no `release`, no `preview`, no asset base, no play
  source, not reachable, and the play route renders the shared unavailable panel with no
  iframe and no `game-assets` reference at all;
- **a preview pointer is a candidate, not a promotion** — the entry stays `coming-soon`,
  the production accessor stays empty, and the rendered play route frames exactly the
  candidate asset base;
- **the pointers cannot be confused** — every blurring combination is rejected by the
  validator;
- **asset serving needs an exact approved pointer** — no catalog state can approve the
  game, and only the exact configured version is served;
- **route validation covers the preview-gated route** in both drift directions, and the
  real repository tree validates clean.

`test/play-routes.unavailable.test.ts` additionally forces the unpromoted state through
the shared fallback suite, and `scripts/validate-catalog.ts` / `validate-routes.ts` run
in `npm run verify`.

## 7. Rollback

See [`planetary-survey-rollback.md`](planetary-survey-rollback.md).
