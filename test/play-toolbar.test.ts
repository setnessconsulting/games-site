import { describe, expect, it } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import PlayToolbar from "../src/components/PlayToolbar.astro";
import { getGame } from "../src/data/games";

describe("PlayToolbar", () => {
  it("renders the back link, game label, and fullscreen control for a promoted game", async () => {
    const game = getGame("bridge-builder")!;
    const container = await AstroContainer.create();
    const html = await container.renderToString(PlayToolbar, {
      props: {
        game,
        canFullscreen: true,
        fullscreenStage: "[data-static-game-stage]"
      }
    });

    expect(html).toContain('class="play-toolbar"');
    expect(html).toContain(`<a class="back-link" href="${game.route}">`);
    expect(html).toContain(`<span class="play-label">${game.title}</span>`);
    expect(html).toContain("data-play-fullscreen");
    expect(html).toContain('data-fullscreen-stage="[data-static-game-stage]"');
    expect(html).toContain('document.querySelector("[data-play-fullscreen]")');
    expect(html).toContain("requestFullscreen");
  });

  it("omits the fullscreen control and its script when no build is promoted", async () => {
    const game = getGame("signal-garden")!;
    const container = await AstroContainer.create();
    const html = await container.renderToString(PlayToolbar, {
      props: {
        game,
        canFullscreen: false,
        fullscreenStage: "[data-game-stage]"
      }
    });

    expect(html).toContain('class="play-toolbar"');
    expect(html).toContain(`<a class="back-link" href="${game.route}">`);
    expect(html).toContain(`<span class="play-label">${game.title}</span>`);
    expect(html).not.toContain("data-play-fullscreen");
    expect(html).not.toContain("data-fullscreen-stage");
    expect(html).not.toContain("requestFullscreen");
  });
});
