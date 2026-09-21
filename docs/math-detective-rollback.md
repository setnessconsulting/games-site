# Math Detective — Live Rollback Rehearsal

Recorded 2026-09-20 for the Math Detective production release.

## Release and targets

- Candidate artifact: `math-detective/2026.09.20-visual-pass.1/`.
- Rollback target: Pages deployment `50118dc5-cd3c-4d99-8f22-8244f9040e97`, source
  `ec0328a2321a388593effd27a7eadf554d76a12e`.
- Restore target: Pages deployment `3691f315-8a13-40e4-8984-e13aedbecf60`, source
  `a2527d822d351ff175824021e26258b19c9da59b`.
- The restore target was selected from the active production alias immediately before the
  rehearsal, so intervening Number Line Jumper work was preserved.

## Rehearsal evidence

1. Cloudflare Pages rollback switched the production alias to `50118dc5`.
2. At `2026-09-21T00:00:22Z`, Playwright verified both the Pages hostname and
   `https://games.setnessconsulting.com`:
   - the Math Detective collection card was `COMING SOON`;
   - `/math-detective/play/` returned `200` and showed the prepared-but-not-playable state;
   - no game iframe or Math Detective asset was loaded.
3. Cloudflare Pages rollback restored `3691f315`.
4. At `2026-09-21T00:01:18Z`, Playwright verified both hostnames again:
   - the Math Detective collection card was `PLAYABLE`;
   - `/math-detective/play/` returned `200` and loaded the exact immutable entry;
   - `index.html`, the JavaScript bundle, the CSS bundle, and the Phaser module returned `200`;
   - the case desk rendered with “The Case of the Mixed-Up Medals.”
5. The documentation merge produced Pages deployment `2fad9797-7651-4055-aa6a-d13f384c5d38`
   from games-site commit `89767dc3393799ed8133e03124691e912ca09a79`. At
   `2026-09-21T00:07:47Z`, Playwright rechecked that deployment and the custom domain; the
   collection remained `PLAYABLE`, the exact immutable entry remained loaded, and its assets
   still returned `200`.

## Boundary

This was an operational Pages alias rollback and restore. No R2 object was deleted, overwritten,
or republished, and no game source or immutable release artifact changed.
