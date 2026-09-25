# Motion Lab host contract

Status: established by GAME-385 / ML-HOST
Game repository: `setnessconsulting/game-motion-lab`
Jira: GAME-382 (Epic), GAME-385 (ML-HOST), promotion owned by GAME-401 (ML-PROMOTE)

This document is the host target for Motion Lab. It exists so the game repository can build
against a known contract without coupling itself to games-site internals, and so **production
stays unavailable until promotion**.

> **Nothing is promoted.** Motion Lab has no production release, no
> `MOTION_LAB_PRODUCTION_VERSION`, and no `release` in the catalog. The catalog entry is
> `coming-soon`. That is the current, intended state, not an oversight.

This contract deliberately follows the Planetary Survey precedent
([`planetary-survey-host-contract.md`](planetary-survey-host-contract.md)) rather than inventing a
second mechanism. Two unreleased games sharing one host pattern is worth more than two bespoke ones,
and the catalog invariants that keep a preview pointer from becoming a promotion are already
enforced and tested.

---

## 1. Host identity

| Fact             | Value                                        |
| ---------------- | -------------------------------------------- |
| Slug             | `motion-lab`                                 |
| Release kind     | `static-web` (planned; not yet selected)     |
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

`<version>` is an immutable, path-safe identifier. For the ML-HOST evidence artifact it is
`0.1.0-ml-host-evidence.1`, derived as `<package.json version>-<releaseQualifier>`. A real release
uses the same shape with a qualifier that names the qualification pass. An override is available
through `MOTION_LAB_VERSION` for pinning an exact candidate during qualification.

Be precise about what that identifier was proven against. The ML-HOST evidence was produced from the
**ML-02 foundation build** — the application shell, the real Phaser renderer, and the balanced-force
bootstrap — served at the exact prefix above by a local host and driven by a real browser. It proves
the _path, base-URL and asset contract_, which is what this story owns. It is not evidence about the
finished game, and no part of it was uploaded or deployed.

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

**Why not reuse the older `*_PREVIEW_VERSION` mechanism.** For the six promoted games, that
mechanism swaps the _production_ version of an entry that is already `playable`. Applying it here
would require flipping `status` to `playable` first — making the qualification preview and the
promotion the same change, so a mistaken merge would silently promote an unqualified build. Here the
entry stays `coming-soon` in every environment; only the presence of a preview pointer changes, and
that pointer can never be read as production.

---

## 3. Preview behaviour

`MOTION_LAB_PREVIEW_VERSION` is a **preview-only** exact-version override. It is declared in
`wrangler.jsonc` and currently empty, because no Motion Lab candidate has been published yet: empty
is treated as "not configured" everywhere it is read, so declaring it changes nothing at runtime
while keeping the variable typed for the qualification pass that sets it.

| Environment             | Variable                | Result                                                                                                                                    |
| ----------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Production              | unset                   | no pointer of any kind; `/motion-lab/play/` renders the shared unavailable panel; the collection does not link the game                   |
| Preview / qualification | set to an exact version | that version is the candidate asset base; the launcher offers "Open the qualification preview"; the play route frames the exact candidate |

Preview behaviour is intentionally explicit rather than automatic:

- the launcher label says **qualification preview**, never "Play";
- the launcher page renders a machine-readable host-status block
  (`data-slot="motion-lab-host-status"` with `data-catalog-status`, `data-preview-pointer`,
  `data-preview-asset-base`) so a real build's real state can be asserted rather than trusting this
  prose;
- asset serving still requires an exact match. `isApprovedRelease` cannot approve Motion Lab through
  its catalog fallback, because the catalog promotes nothing — only a deployment-supplied pointer can
  approve an asset, and only for that exact version. A deployment that forgets the pointer serves
  404s rather than serving an unqualified candidate.

`previewEnabled: true` on the entry is what permits the play route to exist for a `coming-soon`
game. It is a reviewable source statement, not an environment check, so production and preview
validate identically. Route validation additionally fails if `previewEnabled` is declared without a
matching play page, and still fails if a `coming-soon` game exposes a play page without opting in.

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

## 5. Promotion (not done here, owned by ML-PROMOTE)

Promotion is a reviewed catalog change in this repository:

1. confirm the immutable candidate passes its science, accessibility, comparator, device, rollback,
   provenance, and playtest gates (GAME-401 / ML-PROMOTE);
2. add `MOTION_LAB_PRODUCTION_VERSION` and select the exact immutable release;
3. change the entry from `coming-soon` to `playable`, removing the preview pointer;
4. pass repository CI and hosted preview qualification;
5. merge. The merge commit is the production promotion identity.

Until step 5 lands, no Motion Lab build is reachable in production, and the entry must remain
`coming-soon`.

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

- **production selects nothing** — no `release`, no `preview`, no asset base, no play source, not
  reachable, and the play route renders the shared unavailable panel with no iframe and no
  `game-assets` reference at all;
- **a preview pointer is a candidate, not a promotion** — the entry stays `coming-soon`, the
  production accessor stays empty, and the rendered play route frames exactly the candidate asset
  base;
- **the pointers cannot be confused** — every blurring combination is rejected by the validator;
- **asset serving needs an exact approved pointer** — no catalog state can approve the game, and only
  the exact configured version is served;
- **route validation covers the preview-gated route** in both drift directions, and the real
  repository tree validates clean.

On the game side, `npm run test:host` proves the base-path contract against the real build, and that
lane has been observed failing when the base path is deliberately broken.

`test/play-routes.unavailable.test.ts` additionally forces the unpromoted state through the shared
fallback suite, and `scripts/validate-catalog.ts` / `validate-routes.ts` run in `npm run verify`.

## 8. What is not claimed

- No Motion Lab candidate has been uploaded to R2 yet. `MOTION_LAB_PREVIEW_VERSION` is empty, so the
  preview environment currently serves the unavailable panel exactly as production does. Hosting a
  real candidate is GAME-399 / ML-15.
- No hosted qualification has been performed against a real deployment.
- No science, accessibility, comparator, device, or playtest gate has passed for this game.
- Nothing has been promoted, and no rollback has been exercised.

## 9. Rollback

See [`motion-lab-rollback.md`](motion-lab-rollback.md).
