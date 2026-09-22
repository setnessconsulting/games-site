# Setness Games

The shared arcade site for small games and interactive worlds.

The site is a static Astro application deployed through Cloudflare Pages. Large browser-game builds
are stored in a private Cloudflare R2 bucket and served through a same-domain Pages Function.

## Local development

```bash
npm install
npm run dev
```

Run the full local verification suite with:

```bash
npm run verify
```

### Playable assets locally

`npm run preview` serves only the static Astro output. `/game-assets/*` is a Cloudflare Pages
Function backed by R2, so Unity loaders and static-web iframes will not resolve under plain
`astro preview` (the iframe may still fire `load` on a 404 document; the play frame now probes the
entry URL and shows the error panel instead).

To exercise play routes with real assets, build then run Pages + Functions locally:

```bash
npm run build
npm run preview:pages
```

That uses `wrangler pages dev dist` with the `GAME_ASSETS` R2 binding from `wrangler.jsonc`
(Cloudflare login required). For fixture-only WebGL smoke without production artifacts, see
[`fixtures/webgl-smoke/README.md`](fixtures/webgl-smoke/README.md).

### Route integrity

Internal routes and links are validated statically (no browser or dev server) before code reaches
CI:

```bash
npm run validate:routes
```

The check derives the site's routes from `src/pages` and `public/_routes.json`, then verifies every
registry route, play route, unavailable-game target, and known static link (header, launcher,
back links) resolves. It also fails on duplicate or conflicting catalog routes. Broken routes are
reported with their source, for example:

```
weather-comand: configured route "/weather-comand/" has no matching site route
```

The site is designed to run at the root of `games.setnessconsulting.com`:

- `/` — arcade collection
- `/bridge-builder/` — Bridge Builder launcher
- `/math-detective/` — Math Detective launcher
- `/signal-garden/` — Signal Garden launcher
- `/signal-garden/play/` — game view
- `/<slug>/` — game launcher
- `/<slug>/play/` — game view
- `/game-assets/<slug>/<version>/...` — selected immutable build assets from R2

The release contract supports both Unity/WebGL builds and static-web/semantic-DOM builds without
forcing one runtime into the other's manifest shape.

## Repository boundaries

This repository owns the arcade shell, catalog, launcher, deployment configuration, selected
production version, promotion, rollback, and release contract. Individual game repositories own
their source, tests, production build, and immutable release evidence.

See [the architecture](docs/architecture.md), [deployment checklist](docs/deployment.md), and
[game release contract](docs/game-release-contract.md) before publishing a playable build.

Bridge Builder is developed and tested in the standalone
[`game-bridge-builder`](https://github.com/setnessconsulting/game-bridge-builder) repository. Its
production catalog selects the approved immutable release after hosted qualification and named
approval gates. LevelBest is a separate post-approval promotion.
