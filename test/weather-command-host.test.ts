// Weather Command host contract: production stays coming-soon until WC-PROMOTE, and a
// supplied preview pointer hosts the exact immutable candidate without promoting it.
import { afterEach, describe, expect, it, vi } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";

const PREVIEW_VERSION = "0.1.0-qualification.3";

async function importWithPreview(version: string | undefined) {
  vi.stubEnv("WEATHER_COMMAND_PREVIEW_VERSION", version);
  vi.resetModules();
  return await import("../src/data/games");
}

describe("weather-command host identity", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("declares no production release and no preview pointer in the production state", async () => {
    vi.stubEnv("WEATHER_COMMAND_PREVIEW_VERSION", undefined);
    vi.resetModules();
    const { games, getGame } = await import("../src/data/games");
    const game = getGame("weather-command")!;

    expect(game.status).toBe("coming-soon");
    expect(game.release).toBeUndefined();
    expect(game.preview).toBeUndefined();
    expect(games.find((entry) => entry.slug === "weather-command")?.previewEnabled).toBe(true);
  });

  it("resolves no play source and is not reachable in the production state", async () => {
    vi.stubEnv("WEATHER_COMMAND_PREVIEW_VERSION", undefined);
    vi.resetModules();
    const { getGame, getStaticWebPlaySource, getReachablePlaySource, isGameReachable } =
      await import("../src/data/games");
    const game = getGame("weather-command")!;

    expect(getStaticWebPlaySource(game)).toBeUndefined();
    expect(getReachablePlaySource(game)).toBeUndefined();
    expect(isGameReachable(game)).toBe(false);
  });

  it("renders the production play route as the shared unavailable panel", async () => {
    vi.stubEnv("WEATHER_COMMAND_PREVIEW_VERSION", undefined);
    vi.resetModules();
    const { default: Play } = await import("../src/pages/weather-command/play.astro");
    const container = await AstroContainer.create();
    const html = await container.renderToString(Play, { partial: false });

    expect(html).toContain('class="not-ready-panel"');
    expect(html).not.toContain("<iframe");
  });

  it("hosts the exact candidate when a preview pointer is supplied, without promoting", async () => {
    const { games, getGame, getGamePreviewSource, isGameReachable } =
      await importWithPreview(PREVIEW_VERSION);
    const game = getGame("weather-command")!;

    expect(game.status).toBe("coming-soon");
    expect(game.release).toBeUndefined();
    expect(game.preview).toEqual({ version: PREVIEW_VERSION, entryFile: "index.html" });
    expect(getGamePreviewSource(game)).toEqual({
      assetBase: `/game-assets/weather-command/${PREVIEW_VERSION}`,
      release: { kind: "static-web", version: PREVIEW_VERSION, entryFile: "index.html" }
    });
    expect(isGameReachable(game)).toBe(true);
    expect(games.find((entry) => entry.slug === "weather-command")?.status).toBe("coming-soon");
  });

  it("renders the preview play route against the exact candidate asset base", async () => {
    await importWithPreview(PREVIEW_VERSION);
    const { default: Play } = await import("../src/pages/weather-command/play.astro");
    const container = await AstroContainer.create();
    const html = await container.renderToString(Play, { partial: false });

    expect(html).toContain(`src="/game-assets/weather-command/${PREVIEW_VERSION}/index.html"`);
    expect(html).not.toContain('class="not-ready-panel"');
  });

  it("renders the launcher candidate link, never a promoted Play button", async () => {
    await importWithPreview(PREVIEW_VERSION);
    const { default: Launcher } = await import("../src/pages/weather-command/index.astro");
    const container = await AstroContainer.create();
    const html = await container.renderToString(Launcher, { partial: false });

    expect(html).toContain("Open the qualification preview");
    expect(html).not.toContain(">Play Weather Command");
  });
});
