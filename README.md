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

The site is designed to run at the root of `games.setnessconsulting.com`:

- `/` — arcade collection
- `/bridge-builder/` — Bridge Builder qualification launcher
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
production catalog entry stays `coming-soon` until the hosted qualification and named approval gates
are complete. LevelBest is a separate post-approval promotion.
