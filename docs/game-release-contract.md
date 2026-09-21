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

## Math Detective

Math Detective uses the single-tester release policy defined in
`game-math-detective/docs/migration/levelbest/math-detective/PLAYTEST_PROTOCOL.md` and merged in
that repository's PR #8. The policy change replaces the former multi-child study requirement
with one owner-selected child tester as a qualitative release gate; it does not remove the
device, performance, authored-presentation, accessibility, rollback, provenance, or approval
requirements.

For the candidate promoted by PR #10:

- version: `2026.09.20-visual-pass.1`;
- source SHA: `6b23e239b48871c0f4a2bf29343d9aebd0ccf9f5`;
- immutable R2 prefix: `math-detective/2026.09.20-visual-pass.1/`;
- entry file: `index.html`;
- owner evidence: on 2026-09-20, the owner reported that one child tester played the hosted
  candidate and judged it good enough for production. No child name or other PII is recorded;
  device, input, timing, and structured session fields were not captured, so this is a
  qualitative acceptance signal rather than a population-level usability claim;
- copy approval: the project owner approved the final production copy for this candidate.

The exact pointer remains reviewable in `src/data/games.ts`, and the hosted preview must resolve
the exact immutable artifact before this promotion is merged.

### Operational closeout

The live rehearsal used Cloudflare Pages deployment
`3691f315-8a13-40e4-8984-e13aedbecf60` from games-site commit
`a2527d822d351ff175824021e26258b19c9da59b` as the restore target; it preserved the Math Detective
pointer while including the later Number Line Jumper restoration. The prior known-good deployment
is `50118dc5.games-site-7pn.pages.dev` from the pre-promotion catalog revision.

The live rollback rehearsal switched the production alias to `50118dc5`, verified the collection
and direct play route as `coming-soon` with Playwright on both the Pages hostname and the custom
domain, then restored `3691f315`. The restored custom-domain route again loaded the exact
`math-detective/2026.09.20-visual-pass.1/index.html` entry and its JavaScript/CSS assets with HTTP
200 responses. The full evidence record is in
[`math-detective-rollback.md`](math-detective-rollback.md); no immutable R2 object was deleted or
overwritten.

The documentation merge then produced Pages deployment `2fad9797-7651-4055-aa6a-d13f384c5d38`
from games-site commit `89767dc3393799ed8133e03124691e912ca09a79`; a post-merge Playwright
readback confirmed that the Math Detective pointer and public play route remained unchanged.

## Rollback

Rollback restores the previous known-good catalog release pointer and deploys that games-site
revision. It never deletes or mutates immutable R2 artifacts. The Math Detective candidate's
rollback has been exercised and recorded against the same release candidate.

## Number Line Jumper

`setnessconsulting/game-number-line-jumper` produces the static-web artifact and its release
manifest. This repository owns the `number-line-jumper` card, launcher, play route, selected
version, promotion, and rollback. The current production catalog selects the validated
`main-12641c0` release.

During hosted qualification, `NUMBER_LINE_JUMPER_PREVIEW_VERSION` is a preview-only exact-version
override. When unset, the catalog selects the checked-in production version. When set, the preview
catalog selects only that version as `static-web` with `index.html`, and the Function allows only
the matching `number-line-jumper/<version>/` prefix. Production leaves the preview override unset
and uses the checked-in production pointer.

LevelBest is a separate host product; this promotion publishes the game on games-site and does not
copy the game runtime into LevelBest.
