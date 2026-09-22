// Structural guard: the "Coming soon" fallback and the play toolbar are shared components.
// A play page that hand-rolls either one should fail this test instead of drifting silently.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pagesDir = fileURLToPath(new URL("../src/pages", import.meta.url));

const PLAY_PAGE_SLUGS = readdirSync(pagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((slug) => existsSync(join(pagesDir, slug, "play.astro")))
  .sort();

/** The stage element each frame component renders for the fullscreen control. */
const FRAME_STAGE_SELECTORS = {
  StaticGameFrame: "[data-static-game-stage]",
  StaticWebGameFrame: "[data-game-stage]",
  WebglGameFrame: "[data-game-stage]"
} as const;

function readPlayPage(slug: string): string {
  return readFileSync(join(pagesDir, slug, "play.astro"), "utf8");
}

describe("play page structure", () => {
  it("discovers every play.astro route from the filesystem", () => {
    expect(PLAY_PAGE_SLUGS.length).toBeGreaterThan(0);
    expect(PLAY_PAGE_SLUGS).toContain("fraction-match");
  });

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

  it("points fullscreen at the stage element its own frame component renders", () => {
    for (const slug of PLAY_PAGE_SLUGS) {
      const source = readPlayPage(slug);
      const frames = Object.keys(FRAME_STAGE_SELECTORS).filter((frame) =>
        source.includes(`<${frame}`)
      );
      const stageProps = source.match(/fullscreenStage="[^"]+"/g) ?? [];

      expect(frames, `${slug} should render exactly one game frame`).toHaveLength(1);
      expect(stageProps, `${slug} should pass one fullscreenStage`).toHaveLength(1);
      expect(stageProps[0], slug).toBe(
        `fullscreenStage="${FRAME_STAGE_SELECTORS[frames[0] as keyof typeof FRAME_STAGE_SELECTORS]}"`
      );
    }
  });
});
