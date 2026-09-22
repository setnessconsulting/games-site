// Structural guard: the "Coming soon" fallback and the play toolbar are shared components.
// A play page that hand-rolls either one should fail this test instead of drifting silently.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PLAY_PAGE_SLUGS = [
  "signal-garden",
  "bridge-builder",
  "number-line-jumper",
  "math-detective",
  "weather-command",
  "ecosystem-rescue"
] as const;

function readPlayPage(slug: string): string {
  return readFileSync(new URL(`../src/pages/${slug}/play.astro`, import.meta.url), "utf8");
}

describe("play page structure", () => {
  it("renders the unavailable state through the shared GameUnavailable component", () => {
    for (const slug of PLAY_PAGE_SLUGS) {
      const source = readPlayPage(slug);

      expect(source, slug).toContain("<GameUnavailable");
      expect(source, slug).not.toContain("not-ready-panel");
      expect(source, slug).not.toContain('<p class="eyebrow">Coming soon</p>');
    }
  });

  it("renders the toolbar through the shared PlayToolbar component", () => {
    for (const slug of PLAY_PAGE_SLUGS) {
      const source = readPlayPage(slug);

      expect(source, slug).toContain("<PlayToolbar");
      expect(source, slug).not.toContain('class="play-toolbar"');
      expect(source, slug).not.toContain("data-fullscreen");
    }
  });
});
