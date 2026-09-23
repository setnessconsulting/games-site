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
- games-site promotion SHA: `95d6cafaf1cea28ea896233df0246ec375816782`
- Production Pages deployment: `bbc964d2-b748-4171-a1a7-11ea37c69d97`
  (`https://bbc964d2.games-site-7pn.pages.dev`)

## Rollback

Rollback restores a previous known-good games-site catalog revision (or removes the Weather
Command production selection). It never deletes or overwrites the immutable R2 prefix.

Previous catalog / deployment restore targets (verified still HTTP 200):

1. **Immediate prior production** — Pages deployment `0d7e1c5e-ad97-427c-b9d1-598ff6dede9a`
   (games-site SHA `8a5e500`, accidental `.1` pin):
   `https://0d7e1c5e.games-site-7pn.pages.dev/weather-command/`
2. **Pre-playable host seam** — Pages deployment `0fea960d-cc85-4871-ba67-c0e9c6a72136`
   (games-site SHA `8b6b0f4`, GAME-339 coming-soon):
   `https://0fea960d.games-site-7pn.pages.dev/weather-command/`

To roll back after this promotion: restore the prior Pages production deployment (or revert the
catalog pointer and redeploy), then verify `/weather-command/` and `/weather-command/play/` on both
the Pages hostname and `games.setnessconsulting.com`.

## Live readback checklist

After promotion (or after rollback restore):

1. `GET /weather-command/` returns 200 and shows Play.
2. `GET /weather-command/play/` returns 200 and loads the iframe.
3. Play iframe `src` is `/game-assets/weather-command/<version>/index.html`.
4. `GET` that asset returns 200 with immutable cache headers.
5. Nested hashed JS/CSS under that prefix return 200.
6. Direct navigation and refresh of the play route still load the same version.

## 2026-09-22 promotion readback

Performed against production after merge of PR #29:

- `https://games.setnessconsulting.com/weather-command/` → 200
- `https://games.setnessconsulting.com/weather-command/play/` → 200; iframe src
  `/game-assets/weather-command/0.1.0-qualification.2/index.html`
- `https://games.setnessconsulting.com/game-assets/weather-command/0.1.0-qualification.2/index.html`
  → 200, `cache-control: public, max-age=31536000, immutable`
- Same three checks on `https://bbc964d2.games-site-7pn.pages.dev/...` → 200
- Rollback targets `0d7e1c5e` and `0fea960d` launcher routes → 200 (available to restore)
