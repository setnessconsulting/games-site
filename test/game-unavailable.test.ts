import { describe, expect, it } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import GameUnavailable from "../src/components/GameUnavailable.astro";
import { games, getGame, getStaticWebPlaySource, getUnityWebglPlaySource } from "../src/data/games";

const PLAY_ROUTE_SLUGS = [
  "signal-garden",
  "bridge-builder",
  "number-line-jumper",
  "math-detective",
  "weather-command",
  "ecosystem-rescue"
] as const;

describe("GameUnavailable", () => {
  it("renders the shared fallback panel with the game heading and copy", async () => {
    const game = getGame("signal-garden")!;
    const container = await AstroContainer.create();
    const html = await container.renderToString(GameUnavailable, {
      props: {
        game,
        heading: "The garden is still growing.",
        description: "There isn’t a playable build here yet. Come back after the next release."
      }
    });

    expect(html).toContain('class="not-ready-panel"');
    expect(html).toContain('<p class="eyebrow">Coming soon</p>');
    expect(html).toContain("<h1>The garden is still growing.</h1>");
    expect(html).toContain(
      "<p>There isn’t a playable build here yet. Come back after the next release.</p>"
    );
    expect(html).not.toContain("<iframe");
  });

  it("links back to the game's own catalog route for every play route", async () => {
    const container = await AstroContainer.create();

    for (const slug of PLAY_ROUTE_SLUGS) {
      const game = getGame(slug)!;
      const html = await container.renderToString(GameUnavailable, {
        props: { game, heading: `${game.title} heading`, description: `${game.title} copy` }
      });

      expect(html).toContain(`<a class="button button-primary" href="${game.route}">`);
      expect(html).toContain(`Return to ${game.title}</a>`);
    }
  });
});

describe("play source resolution", () => {
  it("resolves the promoted release and asset base for a playable static-web game", () => {
    const game = getGame("bridge-builder")!;

    expect(getStaticWebPlaySource(game)).toEqual({
      assetBase: "/game-assets/bridge-builder/0.1.0-qualification.12",
      release: { kind: "static-web", version: "0.1.0-qualification.12", entryFile: "index.html" }
    });
  });

  it("resolves the promoted release and asset base for a playable unity-webgl game", () => {
    const game = getGame("signal-garden")!;

    expect(getUnityWebglPlaySource(game)).toEqual({
      assetBase: "/game-assets/signal-garden/2026-09-21-58f2c29",
      release: {
        kind: "unity-webgl",
        version: "2026-09-21-58f2c29",
        loaderFile: "WebGL.loader.js",
        dataFile: "WebGL.data.br",
        frameworkFile: "WebGL.framework.js.br",
        wasmFile: "WebGL.wasm.br"
      }
    });
  });

  it("resolves a play source for every catalog game that has a play route", () => {
    for (const slug of PLAY_ROUTE_SLUGS) {
      const game = getGame(slug)!;
      const source =
        game.release?.kind === "unity-webgl"
          ? getUnityWebglPlaySource(game)
          : getStaticWebPlaySource(game);

      expect(source, `${slug} should have a play source`).toBeDefined();
    }
  });

  it("returns undefined for coming-soon catalog entries", () => {
    for (const game of games.filter((entry) => entry.status !== "playable")) {
      expect(getStaticWebPlaySource(game)).toBeUndefined();
      expect(getUnityWebglPlaySource(game)).toBeUndefined();
    }
  });

  it("returns undefined when the release kind does not match the play route", () => {
    const unityGame = getGame("signal-garden")!;
    const webGame = getGame("bridge-builder")!;

    expect(getStaticWebPlaySource(unityGame)).toBeUndefined();
    expect(getUnityWebglPlaySource(webGame)).toBeUndefined();
  });

  it("returns undefined when a playable entry has no promoted release", () => {
    const game = { ...getGame("bridge-builder")!, release: undefined };

    expect(getStaticWebPlaySource(game)).toBeUndefined();
  });
});
