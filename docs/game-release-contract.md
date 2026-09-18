# Game release contract

Each game repository owns its source, tests, production build, and immutable release identity.
The arcade site owns presentation, the selected production version pointer, promotion, and rollback.

## Release types

The catalog uses a discriminated `release.kind` contract.

### Unity/WebGL

```ts
{
  kind: "unity-webgl",
  version: "1.2.3",
  loaderFile: "game.loader.js",
  dataFile: "game.data",
  frameworkFile: "game.framework.js",
  wasmFile: "game.wasm"
}
```

The corresponding R2 object prefix is:

```text
<slug>/<version>/
```

Unity filenames are explicit; none are inferred from the display title.

### Static web / semantic DOM

```ts
{
  kind: "static-web",
  version: "2026.09.18-1",
  entryFile: "index.html"
}
```

The corresponding R2 object prefix is:

```text
<slug>/<version>/index.html
<slug>/<version>/assets/...
<slug>/<version>/release-manifest.json
```

For Bridge Builder, the static catalog record uses `kind: "static-web"`, `version`, and `entryFile`.
The separate release manifest records the source commit, version, entry file, every payload file's
hash/size/content type, and validation-evidence references. The manifest itself is metadata and is
not self-hashed.

Every browser build must resolve its referenced files relative to the supplied versioned asset base;
it must not assume that the game is hosted at the domain root. The release route is same-origin and
the Pages Function serves the private `GAME_ASSETS` R2 binding with immutable cache headers.

## Immutable publication

The publishing repository must pin the exact source SHA and dependency lockfile used to produce the
artifact. Release evidence must record at minimum:

- source Git SHA;
- lockfile identity/hash;
- immutable release version;
- aggregate build hash;
- published R2 prefix;
- entry document or Unity filenames.

Objects below an already published `<slug>/<version>/` prefix are immutable. Rebuilds use a new
version; they never overwrite an accepted version.

The publisher must preserve correct `Content-Type`, `Content-Encoding` when compression is used,
and cache metadata. The Pages Function serves approved assets with immutable caching and
`X-Content-Type-Options: nosniff`.

## Candidate validation

A catalog entry stays `coming-soon` without a selected `release` until a candidate is ready for
hosted validation. A promotion PR may select the candidate and mark it `playable`; Cloudflare's
branch preview is the pre-production browser qualification surface. Do not merge that promotion
until the preview resolves the exact immutable artifact and the required direct-navigation, refresh,
mobile, keyboard, reduced-motion, history/focus, and privacy checks pass.

## Qualification and promotion

For Bridge Builder, an unapproved candidate is hosted only by a preview/staging branch or local
fixture. The production catalog remains `coming-soon` while rendering, accessibility, child/device,
performance, rollback, provenance, comparator, and Q-01–Q-23 evidence are incomplete. Mocks and
authored-only checks do not count as release evidence. After the named owner approval gate passes, a
reviewed catalog change may select the exact version and mark it `playable`; the game source remains
in `game-bridge-builder`.

Promotion is a reviewed catalog change in this repository:

1. change the entry from `coming-soon` to `playable`;
2. select the exact immutable release version and kind;
3. pass repository CI and hosted preview qualification;
4. merge the reviewed change.

The merge commit/SHA is the games-site production promotion identity.

## Rollback

Rollback restores the previous known-good catalog release pointer and deploys that games-site
revision. It never deletes or mutates immutable R2 artifacts. A release is not finally accepted
until rollback has been exercised and recorded against the same release candidate.

## Number Line Jumper

`setnessconsulting/game-number-line-jumper` produces the static-web artifact and its release
manifest. This repository owns the `number-line-jumper` card, launcher, play route, selected
version, promotion, and rollback. The catalog entry intentionally remains `coming-soon` until the
Number Line Jumper qualification stories produce a validated candidate.

During hosted qualification, `NUMBER_LINE_JUMPER_PREVIEW_VERSION` is a preview-only exact-version
pointer. When unset, the catalog remains `coming-soon` and the Function denies Number Line Jumper
asset reads. When set, the catalog selects only that version as `static-web` with `index.html`, and
the Function allows only the matching `number-line-jumper/<version>/` prefix. Production must leave
the pointer unset.

LevelBest promotion is a separate, later release action that consumes the exact approved artifact;
it is not part of games-site qualification.
