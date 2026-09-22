// Unavailable-game regression coverage: when the catalog entry is not promoted, every play
// route must render the shared GameUnavailable panel (and never a game frame).
import { describe, expect, it, vi } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";

vi.mock("../src/data/games", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/data/games")>();
  const unpromoted = (slug: string) => {
    const game = actual.getGame(slug);
    return game ? { ...game, status: "coming-soon" as const, release: undefined } : undefined;
  };

  return { ...actual, getGame: unpromoted };
});

import BridgeBuilderPlay from "../src/pages/bridge-builder/play.astro";
import EcosystemRescuePlay from "../src/pages/ecosystem-rescue/play.astro";
import MathDetectivePlay from "../src/pages/math-detective/play.astro";
import NumberLineJumperPlay from "../src/pages/number-line-jumper/play.astro";
import SignalGardenPlay from "../src/pages/signal-garden/play.astro";
import WeatherCommandPlay from "../src/pages/weather-command/play.astro";
import { getGame } from "../src/data/games";

const unavailablePages = [
  {
    slug: "signal-garden",
    heading: "The garden is still growing.",
    description: "There isn’t a playable build here yet. Come back after the next release.",
    Page: SignalGardenPlay
  },
  {
    slug: "bridge-builder",
    heading: "The bridge is unavailable right now.",
    description:
      "There isn’t a playable build here right now. Return to the game page and try again later.",
    Page: BridgeBuilderPlay
  },
  {
    slug: "number-line-jumper",
    heading: "Number Line Jumper is not published yet.",
    description:
      "The arcade route is ready, but no validated production release has been promoted.",
    Page: NumberLineJumperPlay
  },
  {
    slug: "math-detective",
    heading: "The case file is still being prepared.",
    description:
      "There isn’t a playable build here yet. Return to the game page and try again later.",
    Page: MathDetectivePlay
  },
  {
    slug: "weather-command",
    heading: "The forecast desk is still being prepared.",
    description:
      "There isn’t a qualified Weather Command build here yet. Production stays intentionally unavailable until the immutable game candidate passes its science, accessibility, comparator, device, and playtest gates.",
    Page: WeatherCommandPlay
  },
  {
    slug: "ecosystem-rescue",
    heading: "The pond is still being prepared.",
    description:
      "There isn’t a qualified Ecosystem Rescue build here yet. Production stays intentionally unavailable until the candidate passes its science, accessibility, comparator, device, and playtest gates.",
    Page: EcosystemRescuePlay
  }
] as const;

describe("play routes for unavailable games", () => {
  it("renders the shared fallback panel with the game title and copy", async () => {
    for (const { slug, heading, description, Page } of unavailablePages) {
      const game = getGame(slug)!;
      const container = await AstroContainer.create();
      const html = await container.renderToString(Page, { partial: false });

      expect(html, slug).toContain('class="not-ready-panel"');
      expect(html, slug).toContain('<p class="eyebrow">Coming soon</p>');
      expect(html, slug).toContain(`<h1>${heading}</h1>`);
      expect(html, slug).toContain(`<p>${description}</p>`);
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
