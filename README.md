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
- `/signal-garden/` — Signal Garden launcher
- `/signal-garden/play/` — game view
- `/game-assets/...` — approved versioned build assets from R2

## Repository boundaries

This repository owns the arcade shell, catalog, launcher, deployment configuration, and release
contract. Individual game repositories own their game source and build pipeline.

See [the architecture](docs/architecture.md), [deployment checklist](docs/deployment.md), and
[game release contract](docs/game-release-contract.md) before publishing the first playable build.
