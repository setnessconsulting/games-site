# Signal Garden rollback

Current production release: `2026-09-26-da74c6a` (source `da74c6a544066a538e7f999f18972d2b6ebe33fb`).

Previous known-good release: `2026-09-21-58f2c29` (source `58f2c2917ae15fb2299bd13a60a139420bf79690`). The previous production Pages deployment is `aa4cc88e-ef6c-4349-8f36-b530c150ec8f` at `https://aa4cc88e.games-site-7pn.pages.dev`.

To roll back the game while keeping the current site build, change only the Signal Garden `release.version` in `src/data/games.ts` to `2026-09-21-58f2c29`, validate the catalog and route, and merge the reviewed rollback change. The old immutable R2 prefix remains available. Do not overwrite or delete either release prefix.
