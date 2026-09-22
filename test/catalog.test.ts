import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameEntry } from "../src/data/games";
import {
  BRIDGE_BUILDER_PRODUCTION_VERSION,
  ECOSYSTEM_RESCUE_PRODUCTION_VERSION,
  MATH_DETECTIVE_PRODUCTION_VERSION,
  NUMBER_LINE_JUMPER_PRODUCTION_VERSION,
  games,
  getGamePlayRoute
} from "../src/data/games";
import { validateCatalog } from "../src/lib/catalog";

describe("game catalog", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("contains a valid, unique catalog", () => {
    expect(validateCatalog(games)).toEqual([]);
    expect(new Set(games.map((game) => game.slug)).size).toBe(games.length);
  });

  it("keeps unpublished games unpromoted while published games select exact releases", () => {
    const bridgeBuilder = games.find((game) => game.slug === "bridge-builder");
    const signalGarden = games.find((game) => game.slug === "signal-garden");
    const mathDetective = games.find((game) => game.slug === "math-detective");
    const unrelatedGames = games.filter(
      (game) =>
        game.slug !== "bridge-builder" &&
        game.slug !== "signal-garden" &&
        game.slug !== "math-detective" &&
        game.slug !== "ecosystem-rescue" &&
        game.slug !== "weather-command"
    );
    expect(
      unrelatedGames.every(
        (game) =>
          game.slug === "number-line-jumper" || (game.status === "coming-soon" && !game.release)
      )
    ).toBe(true);
    expect(games.find((game) => game.slug === "weather-command")?.status).toBe("playable");
    expect(games.find((game) => game.slug === "weather-command")?.release).toEqual({
      kind: "static-web",
      version: "0.1.0-qualification.1",
      entryFile: "index.html"
    });
    expect(games.find((game) => game.slug === "number-line-jumper")?.status).toBe("playable");
    expect(signalGarden?.status).toBe("playable");
    expect(signalGarden?.release).toEqual({
      kind: "unity-webgl",
      version: "2026-09-21-58f2c29",
      loaderFile: "WebGL.loader.js",
      dataFile: "WebGL.data.br",
      frameworkFile: "WebGL.framework.js.br",
      wasmFile: "WebGL.wasm.br"
    });
    expect(mathDetective?.status).toBe("playable");
    expect(mathDetective?.release).toEqual({
      kind: "static-web",
      version: MATH_DETECTIVE_PRODUCTION_VERSION,
      entryFile: "index.html"
    });
    expect(bridgeBuilder?.status).toBe("playable");
    expect(bridgeBuilder?.release).toEqual({
      kind: "static-web",
      version: BRIDGE_BUILDER_PRODUCTION_VERSION,
      entryFile: "index.html"
    });
    expect(bridgeBuilder?.route).toBe("/bridge-builder/");
    expect(getGamePlayRoute(bridgeBuilder!)).toBe("/bridge-builder/play/");
  });

  it("accepts the static-web release shape for a candidate preview", () => {
    const candidate = {
      ...games.find((game) => game.slug === "bridge-builder")!,
      status: "playable" as const,
      release: {
        kind: "static-web" as const,
        version: "0.1.0",
        entryFile: "index.html"
      }
    };
    expect(validateCatalog([candidate])).toEqual([]);
  });

  it("derives game-specific play routes instead of hard-coding a title", () => {
    const game = games.find((entry) => entry.slug === "number-line-jumper");
    expect(game).toBeDefined();
    expect(getGamePlayRoute(game!)).toBe("/number-line-jumper/play/");
  });

  it("selects the production release when its preview pointer is unset", async () => {
    vi.stubEnv("NUMBER_LINE_JUMPER_PREVIEW_VERSION", "");
    vi.resetModules();
    const { games: catalog } = await import("../src/data/games");
    const game = catalog.find((entry) => entry.slug === "number-line-jumper");

    expect(game?.status).toBe("playable");
    expect(game?.release).toEqual({
      kind: "static-web",
      version: NUMBER_LINE_JUMPER_PRODUCTION_VERSION,
      entryFile: "index.html"
    });
  });

  it("overrides the production release with the exact Number Line Jumper preview version", async () => {
    vi.stubEnv("NUMBER_LINE_JUMPER_PREVIEW_VERSION", "main-12641c0-preview");
    vi.resetModules();
    const { games: catalog } = await import("../src/data/games");
    const game = catalog.find((entry) => entry.slug === "number-line-jumper");

    expect(game?.status).toBe("playable");
    expect(game?.release).toEqual({
      kind: "static-web",
      version: "main-12641c0-preview",
      entryFile: "index.html"
    });
  });

  it("selects the Math Detective production release when its preview pointer is unset", async () => {
    vi.stubEnv("MATH_DETECTIVE_PREVIEW_VERSION", "");
    vi.resetModules();
    const { games: catalog } = await import("../src/data/games");
    const game = catalog.find((entry) => entry.slug === "math-detective");

    expect(game?.status).toBe("playable");
    expect(game?.release).toEqual({
      kind: "static-web",
      version: MATH_DETECTIVE_PRODUCTION_VERSION,
      entryFile: "index.html"
    });
  });

  it("overrides the Math Detective production release with the exact preview version", async () => {
    vi.stubEnv("MATH_DETECTIVE_PREVIEW_VERSION", "2026.09.20-visual-pass.1-preview");
    vi.resetModules();
    const { games: catalog } = await import("../src/data/games");
    const game = catalog.find((entry) => entry.slug === "math-detective");

    expect(game?.status).toBe("playable");
    expect(game?.release).toEqual({
      kind: "static-web",
      version: "2026.09.20-visual-pass.1-preview",
      entryFile: "index.html"
    });
  });

  it("pins Weather Command to the qualification candidate, overridable by preview env", async () => {
    vi.stubEnv("WEATHER_COMMAND_PREVIEW_VERSION", "");
    vi.resetModules();
    let module = await import("../src/data/games");
    let game = module.games.find((entry) => entry.slug === "weather-command");

    expect(game?.status).toBe("playable");
    expect(game?.release).toEqual({
      kind: "static-web",
      version: "0.1.0-qualification.1",
      entryFile: "index.html"
    });
    expect(game?.route).toBe("/weather-command/");
    expect(module.getGamePlayRoute(game!)).toBe("/weather-command/play/");

    vi.stubEnv("WEATHER_COMMAND_PREVIEW_VERSION", "main-foundation-preview");
    vi.resetModules();
    module = await import("../src/data/games");
    game = module.games.find((entry) => entry.slug === "weather-command");

    expect(game?.status).toBe("playable");
    expect(game?.release).toEqual({
      kind: "static-web",
      version: "main-foundation-preview",
      entryFile: "index.html"
    });
  });

  it("keeps Ecosystem Rescue on its promoted production release unless a preview is pinned", async () => {
    vi.stubEnv("ECOSYSTEM_RESCUE_PREVIEW_VERSION", "");
    vi.resetModules();
    let module = await import("../src/data/games");
    let game = module.games.find((entry) => entry.slug === "ecosystem-rescue");

    expect(game?.status).toBe("playable");
    expect(game?.release).toEqual({
      kind: "static-web",
      version: ECOSYSTEM_RESCUE_PRODUCTION_VERSION,
      entryFile: "index.html"
    });
    expect(game?.route).toBe("/ecosystem-rescue/");
    expect(module.getGamePlayRoute(game!)).toBe("/ecosystem-rescue/play/");

    vi.stubEnv("ECOSYSTEM_RESCUE_PREVIEW_VERSION", "0.1.0-qualification.9");
    vi.resetModules();
    module = await import("../src/data/games");
    game = module.games.find((entry) => entry.slug === "ecosystem-rescue");

    expect(game?.release).toEqual({
      kind: "static-web",
      version: "0.1.0-qualification.9",
      entryFile: "index.html"
    });
  });

  it("accepts both release kinds when promoted", () => {
    const webGame: GameEntry = {
      ...games[0],
      slug: "static-example",
      route: "/static-example/",
      status: "playable",
      release: { kind: "static-web", version: "2026.09.18-1", entryFile: "index.html" }
    };
    const unityGame: GameEntry = {
      ...games[0],
      slug: "unity-example",
      route: "/unity-example/",
      status: "playable",
      release: {
        kind: "unity-webgl",
        version: "1.0.0",
        loaderFile: "game.loader.js",
        dataFile: "game.data",
        frameworkFile: "game.framework.js",
        wasmFile: "game.wasm"
      }
    };

    expect(validateCatalog([webGame, unityGame])).toEqual([]);
  });

  it("rejects unsafe static-web and Unity release paths", () => {
    const unsafeWeb: GameEntry = {
      ...games[0],
      slug: "unsafe-web",
      route: "/unsafe-web/",
      status: "playable",
      release: { kind: "static-web", version: "1.0.0", entryFile: "../index.html" }
    };
    const unsafeUnity: GameEntry = {
      ...games[0],
      slug: "unsafe-unity",
      route: "/unsafe-unity/",
      status: "playable",
      release: {
        kind: "unity-webgl",
        version: "1.0.0",
        loaderFile: "Build/game.loader.js",
        dataFile: "game.data",
        frameworkFile: "game.framework.js",
        wasmFile: "game.wasm"
      }
    };

    expect(validateCatalog([unsafeWeb]).join("\n")).toContain("safe relative asset path");
    expect(validateCatalog([unsafeUnity]).join("\n")).toContain("safe filename");
  });
});
