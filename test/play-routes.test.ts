// Playable-game regression coverage: promoted games must render their game frame and
// must never fall back to the shared "Coming soon" panel.
import { describe, expect, it } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import BridgeBuilderPlay from "../src/pages/bridge-builder/play.astro";
import EcosystemRescuePlay from "../src/pages/ecosystem-rescue/play.astro";
import MathDetectivePlay from "../src/pages/math-detective/play.astro";
import NumberLineJumperPlay from "../src/pages/number-line-jumper/play.astro";
import SignalGardenPlay from "../src/pages/signal-garden/play.astro";
import WeatherCommandPlay from "../src/pages/weather-command/play.astro";
import {
  BRIDGE_BUILDER_PRODUCTION_VERSION,
  ECOSYSTEM_RESCUE_PRODUCTION_VERSION,
  MATH_DETECTIVE_PRODUCTION_VERSION,
  NUMBER_LINE_JUMPER_PRODUCTION_VERSION,
  WEATHER_COMMAND_PRODUCTION_VERSION,
  getGame
} from "../src/data/games";

const staticWebPages = [
  {
    slug: "bridge-builder",
    version: BRIDGE_BUILDER_PRODUCTION_VERSION,
    stage: "[data-static-game-stage]",
    Page: BridgeBuilderPlay
  },
  {
    slug: "ecosystem-rescue",
    version: ECOSYSTEM_RESCUE_PRODUCTION_VERSION,
    stage: "[data-static-game-stage]",
    Page: EcosystemRescuePlay
  },
  {
    slug: "math-detective",
    version: MATH_DETECTIVE_PRODUCTION_VERSION,
    stage: "[data-static-game-stage]",
    Page: MathDetectivePlay
  },
  {
    slug: "weather-command",
    version: WEATHER_COMMAND_PRODUCTION_VERSION,
    stage: "[data-static-game-stage]",
    Page: WeatherCommandPlay
  },
  {
    slug: "number-line-jumper",
    version: NUMBER_LINE_JUMPER_PRODUCTION_VERSION,
    stage: "[data-game-stage]",
    Page: NumberLineJumperPlay
  }
] as const;

const allPlayPages = [
  ...staticWebPages,
  { slug: "signal-garden", stage: "[data-game-stage]", Page: SignalGardenPlay }
] as const;

async function renderPlayPage(page: (typeof allPlayPages)[number]["Page"]) {
  const container = await AstroContainer.create();
  return container.renderToString(page, { partial: false });
}

describe("play routes for promoted games", () => {
  it("renders the promoted static-web build instead of the unavailable fallback", async () => {
    for (const { slug, version, Page } of staticWebPages) {
      const html = await renderPlayPage(Page);

      expect(html, slug).toContain(`/game-assets/${slug}/${version}/index.html`);
      expect(html, slug).toContain("<iframe");
      expect(html, slug).not.toContain("not-ready-panel");
      expect(html, slug).not.toContain("Coming soon");
    }
  });

  it("renders the promoted Unity build for Signal Garden", async () => {
    const html = await renderPlayPage(SignalGardenPlay);

    expect(html).toContain('data-release-kind="unity-webgl"');
    expect(html).toContain("/game-assets/signal-garden/2026-09-21-58f2c29");
    expect(html).not.toContain("not-ready-panel");
    expect(html).not.toContain("Coming soon");
  });

  it("renders the shared toolbar with the game page back link", async () => {
    for (const { slug, Page } of allPlayPages) {
      const game = getGame(slug)!;
      const html = await renderPlayPage(Page);

      expect(html, slug).toContain(`<title>Play ${game.title} · Setness Games</title>`);
      expect(html, slug).toContain(`<a class="back-link" href="${game.route}">`);
      expect(html, slug).toContain(`<span class="play-label">${game.title}</span>`);
    }
  });

  it("renders one fullscreen control wired to each page's stage", async () => {
    for (const { slug, stage, Page } of allPlayPages) {
      const html = await renderPlayPage(Page);

      expect(html, slug).toContain("Fullscreen");
      expect(html, slug).toContain("data-play-fullscreen");
      expect(html, slug).toContain(`data-fullscreen-stage="${stage}"`);
      expect(html, slug).toContain('document.querySelector("[data-play-fullscreen]")');
    }
  });
});
