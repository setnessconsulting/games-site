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
<slug>/<version>/Build/
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
<slug>/<version>/
```

The entry document and every asset it references must work from the supplied versioned asset base.
Static-web builds therefore use relative/subpath-safe asset URLs and must not assume domain-root
hosting.

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

## Promotion

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
