# Motion Lab host contract

Status: established by GAME-385 / ML-HOST; promotion applied by GAME-401 / ML-PROMOTE
Game repository: `setnessconsulting/game-motion-lab`
Jira: GAME-382 (Epic), GAME-385 (ML-HOST), GAME-401 (ML-PROMOTE)

This document is the host target for Motion Lab. It exists so the game repository can build
against a known contract without coupling itself to games-site internals.

> **Motion Lab is promoted.** GAME-401 / ML-PROMOTE selected one immutable release,
> `0.1.0-ml-host-evidence.1`, from source SHA `f2b89866134e4b106bb17a74730d2e55ef7fdab8`. The
> catalog entry is `playable`, carries that `release`, and `MOTION_LAB_PRODUCTION_VERSION` names
> exactly it.
>
> **Read the promotion honestly.** No independent science review, accessibility sign-off,
> target-age playtest, real-device testing, or rollback rehearsal was performed for this version,
> and none is claimed. What the promoted build contains is the experiment bench only: a
> prediction, four controls, the real Phaser lab, instrument readouts, and a trials table. It has
> no missions, no scoring, no graphs-as-evidence, and no Mystery Cart. The authored content for
> those exists in the game repository (ML-05); the runtime that plays it is GAME-391 (ML-07) and
> GAME-394 (ML-10). Sections 5 and 7 below record this in the same place as the mechanism, so the
> contract cannot be read as a claim that the gates passed.

This contract deliberately follows the Planetary Survey precedent
([`planetary-survey-host-contract.md`](planetary-survey-host-contract.md)) rather than inventing a
second mechanism for the pre-promotion phase. Two unreleased games sharing one host pattern is
worth more than two bespoke ones, and the catalog invariants that keep a candidate pointer from
becoming a promotion were written before there was anything to promote — which is why promotion
could be a plain reviewed catalog change rather than a rewrite of the host.

---

## 1. Host identity

| Fact             | Value                                        |
| ---------------- | -------------------------------------------- |
| Slug             | `motion-lab`                                 |
| Release kind     | `static-web` (selected)                      |
| Index route      | `/motion-lab/`                               |
| Play route       | `/motion-lab/play/`                          |
| Asset base       | `/game-assets/motion-lab/<version>/`         |
| R2 object prefix | `motion-lab/<version>/`                      |
| Entry document   | `index.html`                                 |
| Release manifest | `motion-lab/<version>/release-manifest.json` |

The identity above is declared once, in the game repository, at `host-identity.json`, and read by
`scripts/lib/host-identity.mjs`. The nested host server, the Playwright host lane, and the release
manifest all read that one module, so a prefix that drifts in one place cannot disagree with the
other.

`<version>` is an immutable, path-safe identifier, derived as `<package.json version>-<releaseQualifier>`.
The promoted version is `0.1.0-ml-host-evidence.1`. An override is available through
`MOTION_LAB_VERSION` for pinning an exact candidate during qualification.

Be precise about what that identifier was proven against, and about where the bytes came from. The
qualifier is the one declared in the game repository's `host-identity.json` (`ml-host-evidence.1`),
which was written for the ML-HOST evidence build. It was not renamed at promotion, so the version
string names ML-HOST's release identity while the published bytes are a build from
`f2b89866134e4b106bb17a74730d2e55ef7fdab8` — the ML-05 merge, not the ML-02 foundation build. The
release manifest's `sourceSha` is what actually identifies the artifact, and `npm run release:check`
fails if it does not match the tree. What ML-HOST proved at this prefix is the _path, base-URL and
asset contract_: it was proven against the ML-02 foundation build, served at the exact prefix above
by a local host and driven by a real browser, and no part of that evidence build was uploaded or
deployed. The ML-HOST evidence is evidence about the contract, not about this artifact's contents.

### Base path expectations

The artifact must resolve every referenced file relative to the supplied versioned asset base and
must never assume domain-root deployment. The Vite build sets `base: "./"` for exactly this reason.

This is enforced on the game side, not merely documented. `npm run test:host` serves the real
production build from the exact prefix above (`scripts/nested-host-server.mjs`) and fails if any
request escapes it, 404s, or if the served document's own references resolve outside the prefix.

The check is verified in both directions. Building with `base: "/"` instead makes the lane fail with
the actual diagnosis:

```text
[initial document] these requests escaped the version prefix, so the build assumed
domain-root deployment: /assets/index-J4c-P9Ki.js, /assets/index-BmbtKz38.css
```

A base-path test that has never been seen to fail is a test of nothing.

### Cache and security expectations

Assets are served by the Pages Function under `functions/game-assets/` with:

- immutable cache headers (`public, max-age=31536000, immutable`);
- `X-Content-Type-Options: nosniff`;
- document CSP and `X-Frame-Options: SAMEORIGIN` for HTML documents, so the same-origin play
  iframe works while cross-origin embedding is refused.

Objects below a published `<slug>/<version>/` prefix are immutable. Rebuilds use a new version; they
never overwrite an accepted one.

### Compression is part of this contract, not an implementation detail

ML-02 measured the same build two ways in one session: served raw, LCP was **9061 ms** and the
Lighthouse performance score **0.53**; served gzipped, LCP was **1402 ms** and the score **1.00**.

The payload is dominated by a 1.37 MB Phaser chunk, so **host compression changes perceived load by
more than 6×**. Two consequences for the host:

1. the games-site static host must serve text assets compressed, and the qualification pass must
   confirm the real headers rather than assume them;
2. if compression is unavailable, lazy-loading the renderer chunk stops being optional and becomes
   load-bearing, which is a decision for ML-15 / ML-PROMOTE made with this evidence in hand.

Recording a Lighthouse number without recording the compression it was measured under would make
the number meaningless. `performance/lighthouse.json` in the game repository carries the assumption
explicitly.

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
| Populated by             | a reviewed catalog promotion                            | `MOTION_LAB_PREVIEW_VERSION` on the deployment                            |

They are separate types on purpose. If they shared a shape, some future edit would promote a
candidate by copying the wrong field. The validator rejects every combination that would blur them:

- a `playable` entry carrying a preview pointer;
- an entry carrying both a `release` and a `preview`;
- a `coming-soon` entry carrying a `release`;
- `previewEnabled` on a `playable` entry.

**Why the older `*_PREVIEW_VERSION` mechanism was not used before promotion.** For the six promoted
games, that mechanism swaps the _production_ version of an entry that is already `playable`. Using it
before promotion would have required flipping `status` to `playable` first — making the qualification
preview and the promotion the same change, so a mistaken merge would have silently promoted an
unqualified build. While unpromoted, the entry therefore stayed `coming-soon` in every environment
and only the presence of a preview pointer changed.

Promotion retired that shape. The `preview`/`previewEnabled` pair is gone from the Motion Lab entry,
and `MOTION_LAB_PREVIEW_VERSION` now works exactly as it does for the other six promoted games: it
overrides the released version for a qualification pass. The `GamePreview` mechanism, and every
validator rule above that keeps it from blurring with a promotion, remains in place and still
enforced — Planetary Survey still relies on it, and the rules are now asserted against Motion Lab's
_promoted_ entry as the negative case.

---

## 3. Preview behaviour after promotion

`MOTION_LAB_PREVIEW_VERSION` is a **preview-only** exact-version override. It is declared in
`wrangler.jsonc` and empty, which is treated as "not configured" everywhere it is read, so the
committed production version is what every environment selects by default.

| Environment               | Variable                          | Result                                                                                                                                                             |
| ------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Production                | unset                             | the committed release `0.1.0-ml-host-evidence.1`; `/motion-lab/play/` frames that exact artifact and the collection links the game                                 |
| Preview / qualification   | set to an exact version           | that version replaces the release version for this deployment only; the play route frames the pinned candidate, and only that exact `motion-lab/<version>/` prefix |
| Production, misconfigured | set to a version nobody published | asset requests 404 and the play route's frame has nothing to load; nothing is promoted by the variable                                                             |

Behaviour is intentionally explicit rather than automatic:

- the launcher label is **Play**, because the entry is promoted; a pinned candidate changes the
  version it runs, not the kind of pointer it is;
- the launcher page renders a machine-readable host-status block
  (`data-slot="motion-lab-host-status"` with `data-catalog-status`, `data-release-version`,
  `data-play-asset-base`) so a real build's real state can be asserted rather than trusting this
  prose. ML-HOST introduced the block when it reported "no pointer"; promotion flipped its values
  rather than deleting it, so the same assertions still describe the deployed state;
- asset serving still requires an exact match, and promotion changed only _who_ approves. Before
  promotion, only a deployment pointer could approve a Motion Lab asset. Now `isApprovedRelease`
  approves the promoted version through its catalog fallback — a playable entry's selected release —
  and the deployment pointer approves only its own exact string. A deployment that pins a version
  nobody published serves 404s rather than serving an unqualified candidate.

Route validation is static, driven by catalog values rather than the deployment environment, so a
production build validates exactly as a preview build does. It fails if `previewEnabled` is declared
without a matching play page, and fails if a `coming-soon` game exposes a play page without opting
in. Motion Lab no longer needs `previewEnabled`: the entry is `playable`, so its play route is
promoted and the flag would now be rejected by the catalog validator.

---

## 4. Candidate identity and source traceability

Acceptance criterion 3 of ML-HOST requires that a hosted candidate can be traced back to exact
source. That is what the release manifest is for.

`npm run release:manifest` in the game repository writes `release-manifest.json` into the build
output, which is published beneath the same versioned prefix as the artifact:

```json
{
  "schemaVersion": 1,
  "gameSlug": "motion-lab",
  "releaseVersion": "0.1.0-ml-host-evidence.1",
  "sourceSha": "<exact commit>",
  "sourceBranch": "main",
  "sourceTreeDirty": false,
  "sourceTreeDirtyPaths": [],
  "dependencyLockIdentity": "<sha256 of package-lock.json>",
  "packageVersion": "0.1.0",
  "entryFile": "index.html",
  "assetPrefix": "/game-assets/motion-lab/0.1.0-ml-host-evidence.1",
  "objectPrefix": "motion-lab/0.1.0-ml-host-evidence.1",
  "hostedBy": "setnessconsulting/games-site",
  "files": [{ "path": "...", "bytes": 0, "sha256": "...", "contentType": "..." }]
}
```

Two properties make this usable as identity rather than decoration:

1. **`npm run release:check` recomputes every file hash, the byte length, the source SHA, and the
   resolved version, and fails on any drift.** Promotion must select the exact approved artifact, so
   drift has to be detectable rather than assumed away. The check runs inside `npm run verify`.
2. **No timestamps and no mtimes are recorded.** Two byte-identical rebuilds produce an identical
   manifest. A build timestamp would guarantee that they did not.

`sourceTreeDirty` is computed excluding the generated evidence directories, so it answers the
question that matters — "does the measured source differ from the named commit?" — rather than being
permanently true because writing the record rewrote a tracked file.

### A note on commit ordering

SHA-bound evidence is inherently written one commit after the commit it names. A manifest naming
commit `X` is normally published from commit `Y`. That offset is expected. What would be a defect is
a manifest naming a commit whose source was not what was built, which is why `sourceSha` comes from
`git rev-parse HEAD` at build time and why `release:check` compares it on every run.

---

## 5. Promotion (applied by GAME-401 / ML-PROMOTE)

Promotion is a reviewed catalog change in this repository:

1. confirm the immutable candidate passes its science, accessibility, comparator, device, rollback,
   provenance, and playtest gates (GAME-401 / ML-PROMOTE);
2. add `MOTION_LAB_PRODUCTION_VERSION` and select the exact immutable release;
3. change the entry from `coming-soon` to `playable`, removing the preview pointer;
4. pass repository CI and hosted preview qualification;
5. merge. The merge commit is the production promotion identity.

**Steps 2, 3 and 4 were performed. Step 1 was not.** Say it in the same place as the mechanism, so
this document cannot be read as a claim that the gates passed:

| Gate                                                                                                    | Status                                                                                              |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Immutable candidate published to `setnessconsulting-games` under `motion-lab/0.1.0-ml-host-evidence.1/` | **done** — six objects, each re-downloaded and sha256-matched against the manifest                  |
| Manifest `sourceTreeDirty: false`, `sourceSha` matching the merge commit                                | **done**                                                                                            |
| Catalog change to `playable` with a committed release, and `MOTION_LAB_PRODUCTION_VERSION` added        | **done**                                                                                            |
| Repository CI                                                                                           | **done**                                                                                            |
| Independent science review                                                                              | **not performed**                                                                                   |
| Accessibility sign-off, including a screen-reader pass                                                  | **not performed**                                                                                   |
| Target-age (grades 6–8) playtest                                                                        | **not performed**                                                                                   |
| Real-device / cross-device testing                                                                      | **not performed**                                                                                   |
| Comparator review                                                                                       | **not performed**                                                                                   |
| Rollback rehearsal                                                                                      | **not performed** — see [`motion-lab-rollback.md`](motion-lab-rollback.md)                          |
| Hosted preview qualification against a real deployment                                                  | **not performed** — the promotion was verified directly on the production hostnames after deploying |

The owner authorised proceeding to production promotion with this gate set. The gates above are
recorded rather than claimed.

---

## 6. Coupling boundary

games-site owns presentation, the selected version pointer, promotion, and rollback. The game
repository owns its source, tests, build, and immutable release identity.

The game must not depend on games-site internals, and this repository must not depend on the game's
internals: the contract between them is the versioned prefix, the entry document, the release
manifest, and the cache/security headers above. Nothing in the game imports a games-site module, and
nothing here imports a game module.

**LevelBest is untouched.** This host contract publishes to games-site only. No LevelBest
integration is added, and none is implied.

---

## 7. What the tests actually prove

`test/motion-lab.test.ts` asserts, in both environment states:

- **production selects exactly the promoted release** — the committed version, its asset base, a
  play source, `isGameReachable` true, and no `preview` on the entry at all;
- **a preview pointer is a candidate override, not a second promotion** — the entry stays
  `playable`, there is still no `preview`, the catalog still validates, and the rendered play route
  frames exactly the pinned candidate asset base;
- **the pointers cannot be confused** — every blurring combination is rejected by the validator,
  now including the real promoted entry as the negative case for the rules that used to apply to it;
- **asset serving is approved by the catalog** — the promoted version is served through the
  fallback, a nearly-identical unpromoted version is not, and a deployment pointer approves only its
  own exact string;
- **route validation covers the promoted route** in both drift directions, and the real repository
  tree validates clean.

On the game side, `npm run test:host` proves the base-path contract against the real build, and that
lane has been observed failing when the base path is deliberately broken.

`test/play-routes.unavailable.test.ts` additionally forces an unpromoted state through the shared
fallback suite, and `scripts/validate-catalog.ts` / `validate-routes.ts` run in `npm run verify`.

## 8. What is not claimed

- The promoted artifact is reachable in production. What it **contains** is the experiment bench:
  a prediction, four controls, the real Phaser lab, instrument readouts, and a trials table. It has
  no missions, no scoring, no graphs-as-evidence, and no Mystery Cart. ML-05 authored that content in
  the game repository; the runtime that plays it is GAME-391 (ML-07) and GAME-394 (ML-10).
- No independent science review, accessibility sign-off, target-age playtest, real-device testing,
  comparator review, hosted preview qualification, or rollback rehearsal has been performed for this
  version. Section 5 lists each one. The owner authorised promoting with those gates open.
- No rollback has been exercised. `MOTION_LAB_PREVIEW_VERSION` is empty, so the preview environment
  serves the same promoted version production does.
- This promotion was verified directly on `games-site-7pn.pages.dev` and
  `games.setnessconsulting.com` after deploying, not through a hosted preview pass first.

## 9. Rollback

See [`motion-lab-rollback.md`](motion-lab-rollback.md).
