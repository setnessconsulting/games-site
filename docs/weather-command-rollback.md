# Weather Command rollback

## Production pointer

- Game: `weather-command`
- Kind: `static-web`
- Production version: `0.1.0-qualification.2`
- Source SHA: `0c8563f72ea4490ea419fddbb37a7e2bad74ecfe` (`setnessconsulting/game-weather-command`)
- Immutable R2 prefix: `weather-command/0.1.0-qualification.2/`
- Entry: `index.html`
- Public routes: `/weather-command/`, `/weather-command/play/`
- Assets: `/game-assets/weather-command/0.1.0-qualification.2/...`

## Rollback

Rollback restores a previous known-good games-site catalog revision (or removes the Weather Command
production selection). It never deletes or overwrites the immutable R2 prefix.

Previous catalog states useful as restore targets:

1. **Pre-promotion coming-soon** — GAME-339 host seam only (`8b6b0f4`): Weather Command is
   `coming-soon` with no production `release` unless `WEATHER_COMMAND_PREVIEW_VERSION` is set.
2. **Accidental `.1` pin** — introduced via Ecosystem Rescue card-art merge `8a5e500` before this
   promotion cleaned it up to the SHA-bound `.2` pointer.

To roll back after this promotion: revert the catalog pointer change (or redeploy the prior
known-good Pages deployment), then verify `/weather-command/` and `/weather-command/play/` on both
the Pages hostname and `games.setnessconsulting.com`.

## Live readback checklist

After promotion (or after rollback restore):

1. `GET /weather-command/` returns 200 and shows Play.
2. `GET /weather-command/play/` returns 200 and loads the iframe.
3. `GET /game-assets/weather-command/<version>/index.html` returns 200 with immutable cache headers.
4. Nested hashed JS/CSS under that prefix return 200.
5. Direct navigation and refresh of the play route still load the same version.
