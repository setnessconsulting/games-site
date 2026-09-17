# Game release contract

Each game repository owns its source, build, and release. The arcade site owns presentation and the
approved version pointer.

## Required release shapes

Upload an immutable tagged build to R2 under:

```text
<slug>/<version>/
```

Unity releases retain their existing `Build/` payload and record the exact loader, data, framework,
and WebAssembly filenames in the catalog. Static browser releases, such as Bridge Builder, publish:

```text
<slug>/<version>/index.html
<slug>/<version>/assets/...
<slug>/<version>/release-manifest.json
```

The static catalog release is a discriminated record with `kind: "static"`, `entryFile`, and
`manifestFile`. The manifest records the source commit, version, entry file, every payload file's
hash/size/content type, and validation-evidence references. The manifest itself is metadata and is
not self-hashed.

Every browser build must resolve its referenced files relative to the supplied versioned asset base;
it must not assume that the game is hosted at the domain root. The release route is same-origin and
the Pages Function serves the private `GAME_ASSETS` R2 binding with immutable cache headers.

The publisher must preserve correct `Content-Type`, `Content-Encoding` when compression is used,
and cache metadata. Versioned prefixes are immutable.

## Qualification and promotion

An unapproved candidate is hosted only by a preview/staging branch or local fixture. The production
catalog remains `coming-soon` while rendering, accessibility, child/device, performance, rollback,
provenance, comparator, and Q-01–Q-23 evidence are incomplete. Mocks and authored-only checks do
not count as release evidence.

After the named owner approval gate passes, the game repository opens a pull request that changes the
matching entry in `src/data/games.ts` from `coming-soon` to `playable` and adds its pinned release
version. For Bridge Builder, the source remains in `game-bridge-builder`; this repository owns only
the catalog, launcher, route, and approved release pointer.

Merging that pull request is the production promotion. Reverting it rolls the site back to the prior
catalog state without deleting any R2 build. LevelBest promotion is a separate, later release action
that consumes the exact approved artifact; it is not part of games-site qualification.
