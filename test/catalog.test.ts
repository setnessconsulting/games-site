import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameEntry } from "../src/data/games";
import { BRIDGE_BUILDER_PRODUCTION_VERSION, games, getGamePlayRoute } from "../src/data/games";
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

  it("promotes Bridge Builder while keeping unrelated games unpromoted", () => {
    const bridgeBuilder = games.find((game) => game.slug === "bridge-builder");
    const unrelatedGames = games.filter((game) => game.slug !== "bridge-builder");
    expect(unrelatedGames.every((game) => game.status === "coming-soon" && !game.release)).toBe(
      true
    );
    expect(games.find((game) => game.slug === "number-line-jumper")?.status).toBe("coming-soon");
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

  it("keeps Number Line Jumper coming-soon when its preview pointer is unset", async () => {
    vi.stubEnv("NUMBER_LINE_JUMPER_PREVIEW_VERSION", "");
    vi.resetModules();
    const { games: catalog } = await import("../src/data/games");
    const game = catalog.find((entry) => entry.slug === "number-line-jumper");

    expect(game?.status).toBe("coming-soon");
    expect(game?.release).toBeUndefined();
  });

  it("selects the exact Number Line Jumper version when its preview pointer is set", async () => {
    vi.stubEnv("NUMBER_LINE_JUMPER_PREVIEW_VERSION", "pr8-c7428853083f");
    vi.resetModules();
    const { games: catalog } = await import("../src/data/games");
    const game = catalog.find((entry) => entry.slug === "number-line-jumper");

    expect(game?.status).toBe("playable");
    expect(game?.release).toEqual({
      kind: "static-web",
      version: "pr8-c7428853083f",
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
