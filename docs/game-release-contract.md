# Game release contract

Each game repository owns its source, build, and release. The arcade site owns presentation and the
approved version pointer.

## Required release shape

Upload a tagged build to R2 under:

```text
<slug>/<version>/Build/
```

The build must contain its loader JavaScript, framework JavaScript, data file, and WebAssembly file.
The site manifest records the exact loader, data, framework, and WebAssembly filenames in
`release.loaderFile`, `release.dataFile`, `release.frameworkFile`, and `release.wasmFile`; none may
be inferred from the display title.
The loader must resolve all referenced files relative to the supplied asset base URL; it must not
assume that the game is hosted at the domain root.

The publisher must preserve correct `Content-Type`, `Content-Encoding` when compression is used,
and cache metadata. Versioned prefixes are immutable.

## Promotion

After upload and validation, the game repository opens a pull request that changes the matching
entry in `src/data/games.ts` from `coming-soon` to `playable` and adds its release version.

Merging that pull request is the production promotion. Reverting it rolls the site back to the prior
catalog state without deleting any R2 build.
