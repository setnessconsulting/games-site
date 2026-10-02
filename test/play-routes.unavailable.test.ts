// Unavailable-game regression coverage: every unavailable play route uses the same
// catalog-owned fallback copy and never renders a game frame.
import { describe, expect, it, vi } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";

vi.mock("../src/data/games", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/data/games")>();
  const unpromoted = (slug: string) => {
    const game = actual.getGame(slug);
    if (!game) return undefined;
    // `preview` is stripped as well: this suite is about the UNPROMOTED state, and a
    // qualification candidate surviving here would render an iframe and make the
    // suite assert the opposite of what it means to.
    return { ...game, status: "coming-soon" as const, release: undefined, preview: undefined };
  };

  return { ...actual, getGame: unpromoted };
});

import BridgeBuilderPlay from "../src/pages/bridge-builder/play.astro";
import EcosystemRescuePlay from "../src/pages/ecosystem-rescue/play.astro";
import FractionMatchPlay from "../src/pages/fraction-match/play.astro";
import MathDetectivePlay from "../src/pages/math-detective/play.astro";
import MotionLabPlay from "../src/pages/motion-lab/play.astro";
import NewWorld01Play from "../src/pages/new-world-01/play.astro";
import NewWorld02Play from "../src/pages/new-world-02/play.astro";
import NumberLineJumperPlay from "../src/pages/number-line-jumper/play.astro";
import PlanetarySurveyPlay from "../src/pages/planetary-survey/play.astro";
import SignalGardenPlay from "../src/pages/signal-garden/play.astro";
import WeatherCommandPlay from "../src/pages/weather-command/play.astro";
import { getGame } from "../src/data/games";

const unavailablePages = [
  { slug: "signal-garden", Page: SignalGardenPlay },
  { slug: "bridge-builder", Page: BridgeBuilderPlay },
  { slug: "number-line-jumper", Page: NumberLineJumperPlay },
  { slug: "math-detective", Page: MathDetectivePlay },
  { slug: "motion-lab", Page: MotionLabPlay },
  { slug: "weather-command", Page: WeatherCommandPlay },
  { slug: "ecosystem-rescue", Page: EcosystemRescuePlay },
  { slug: "fraction-match", Page: FractionMatchPlay },
  { slug: "planetary-survey", Page: PlanetarySurveyPlay },
  { slug: "new-world-01", Page: NewWorld01Play },
  { slug: "new-world-02", Page: NewWorld02Play }
] as const;

describe("play routes for unavailable games", () => {
  it("renders the shared fallback panel with catalog-owned copy", async () => {
    for (const { slug, Page } of unavailablePages) {
      const game = getGame(slug)!;
      const container = await AstroContainer.create();
      const html = await container.renderToString(Page, { partial: false });

      expect(html, slug).toContain('class="not-ready-panel"');
      expect(html, slug).toContain('<p class="eyebrow">Coming soon</p>');
      expect(html, slug).toContain(`<h1>${game.unavailableCopy.heading}</h1>`);
      expect(html, slug).toContain(`<p>${game.unavailableCopy.description}</p>`);
      expect(html, slug).toContain(
        `<a class="button button-primary" href="${game.route}">Return to ${game.title}</a>`
      );
    }
  });

  it("does not render a game frame for unavailable games", async () => {
    for (const { slug, Page } of unavailablePages) {
      const container = await AstroContainer.create();
      const html = await container.renderToString(Page, { partial: false });

      expect(html, slug).not.toContain("<iframe");
      expect(html, slug).not.toContain("game-assets");
    }
  });

  it("does not render the fullscreen control for unavailable games", async () => {
    for (const { slug, Page } of unavailablePages) {
      const container = await AstroContainer.create();
      const html = await container.renderToString(Page, { partial: false });

      expect(html, slug).not.toContain("data-play-fullscreen");
      expect(html, slug).not.toContain("data-fullscreen-stage");
      expect(html, slug).not.toContain("requestFullscreen");
    }
  });

  it("keeps the page shell, toolbar, and game title intact", async () => {
    for (const { slug, Page } of unavailablePages) {
      const game = getGame(slug)!;
      const container = await AstroContainer.create();
      const html = await container.renderToString(Page, { partial: false });

      expect(html, slug).toContain('class="site-header compact"');
      expect(html, slug).toContain(`<span class="play-label">${game.title}</span>`);
      expect(html, slug).toContain(`<a class="back-link" href="${game.route}">`);
    }
  });
});
