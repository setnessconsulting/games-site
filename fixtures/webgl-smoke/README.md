# WebGL smoke fixture

This fixture is deliberately tiny and is not a real game. It exists to exercise the same
same-origin asset path that a Unity WebGL release will use:

```text
/game-assets/test-fixture/0.0.0/Build/test-fixture.loader.js
```

Upload the fixture to the local or staging R2 bucket only when testing the Pages Function with
`GAME_ASSETS_ENABLE_FIXTURE=true`. Never add this fixture to the production catalog.
