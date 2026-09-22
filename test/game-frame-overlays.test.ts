// Behavioral coverage for shared loading/error overlays on game frames.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import GameFrameOverlays from "../src/components/GameFrameOverlays.astro";
import StaticGameFrame from "../src/components/StaticGameFrame.astro";
import StaticWebGameFrame from "../src/components/StaticWebGameFrame.astro";
import WebglGameFrame from "../src/components/WebglGameFrame.astro";
import { getGame, getStaticWebPlaySource, getUnityWebglPlaySource } from "../src/data/games";

const componentsDir = fileURLToPath(new URL("../src/components", import.meta.url));

function readComponent(name: string): string {
  return readFileSync(`${componentsDir}/${name}`, "utf8");
}

describe("GameFrameOverlays", () => {
  it("renders static loading and error hooks with rollback copy", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(GameFrameOverlays, {
      props: {
        kind: "static",
        title: "Bridge Builder",
        returnHref: "/bridge-builder/"
      }
    });

    expect(html).toContain("data-static-game-loading");
    expect(html).toContain("Loading Bridge Builder…");
    expect(html).toContain("data-static-game-error");
    expect(html).toContain("Bridge Builder is unavailable");
    expect(html).toContain("The release remains versioned and can be rolled back safely.");
    expect(html).toContain('href="/bridge-builder/"');
    expect(html).toContain("Return to Bridge Builder");
    expect(html).not.toContain("data-game-progress");
    expect(html).not.toContain("data-game-diagnostics");
  });

  it("renders unity loading and error hooks with diagnostics and preparing copy", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(GameFrameOverlays, {
      props: {
        kind: "unity",
        title: "Signal Garden",
        returnHref: "/signal-garden/"
      }
    });

    expect(html).toContain("data-game-loading");
    expect(html).toContain("data-game-progress");
    expect(html).toContain("Preparing Signal Garden…");
    expect(html).toContain("data-game-error");
    expect(html).toContain("Game unavailable");
    expect(html).toContain("this release may be unavailable.");
    expect(html).toContain("data-game-diagnostics");
    expect(html).toContain('href="/signal-garden/"');
    expect(html).toContain("Return to game page");
    expect(html).not.toContain("data-static-game-loading");
  });
});

describe("static frames share GameFrameOverlays", () => {
  it("imports GameFrameOverlays in both iframe frame components", () => {
    for (const file of [
      "StaticGameFrame.astro",
      "StaticWebGameFrame.astro",
      "WebglGameFrame.astro"
    ]) {
      const source = readComponent(file);
      expect(source, file).toContain('from "./GameFrameOverlays.astro"');
      expect(source, file).toContain("<GameFrameOverlays");
    }
  });

  it("renders static overlays and iframe hooks from StaticGameFrame", async () => {
    const game = getGame("bridge-builder")!;
    const playSource = getStaticWebPlaySource(game)!;
    const entryUrl = `${playSource.assetBase}/${playSource.release.entryFile}`;
    const container = await AstroContainer.create();
    const html = await container.renderToString(StaticGameFrame, {
      props: { title: game.title, entryUrl, gamePageUrl: game.route }
    });

    expect(html).toContain("data-static-game-stage");
    expect(html).toContain("data-static-game-loading");
    expect(html).toContain("data-static-game-error hidden");
    expect(html).toContain("data-static-game-frame");
    expect(html).toContain(`src="${entryUrl}"`);
  });

  it("renders static overlays under data-game-stage from StaticWebGameFrame", async () => {
    const game = getGame("number-line-jumper")!;
    const playSource = getStaticWebPlaySource(game)!;
    const container = await AstroContainer.create();
    const html = await container.renderToString(StaticWebGameFrame, {
      props: {
        title: game.title,
        assetBase: playSource.assetBase,
        entryFile: playSource.release.entryFile,
        gamePageUrl: game.route
      }
    });

    expect(html).toContain("data-game-stage");
    expect(html).toContain('data-release-kind="static-web"');
    expect(html).toContain("data-static-game-loading");
    expect(html).toContain("data-static-game-error hidden");
    expect(html).toContain("data-static-game-frame");
    expect(html).toContain(`src="${playSource.assetBase}/${playSource.release.entryFile}"`);
  });

  it("keeps Unity progress and diagnostics hooks on WebglGameFrame", async () => {
    const game = getGame("signal-garden")!;
    const playSource = getUnityWebglPlaySource(game)!;
    const release = playSource.release;
    const container = await AstroContainer.create();
    const html = await container.renderToString(WebglGameFrame, {
      props: {
        title: game.title,
        version: release.version,
        assetBase: playSource.assetBase,
        loaderFile: release.loaderFile,
        dataFile: release.dataFile,
        frameworkFile: release.frameworkFile,
        wasmFile: release.wasmFile,
        returnRoute: game.route
      }
    });

    expect(html).toContain('data-release-kind="unity-webgl"');
    expect(html).toContain("data-game-loading");
    expect(html).toContain("data-game-progress");
    expect(html).toContain("data-game-error");
    expect(html).toContain("data-game-diagnostics");
    expect(html).toContain("data-game-canvas");
  });
});
