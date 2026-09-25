// GAME-385 / ML-HOST: the Motion Lab host contract.
//
// The story exists to prepare the host for this game WITHOUT promoting an unfinished build.
// The two claims that matter, and the reason this file is this thorough:
//
//   1. production selects nothing for this game, and
//   2. a supplied preview pointer is a candidate, never a promotion.
//
// Both are asserted in both environment states, because a check that only ever runs in one of
// them cannot distinguish "safe by design" from "safe by luck".
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";

import {
  MOTION_LAB_SLUG,
  games,
  getGame,
  getGameAssetBase,
  getGamePlayRoute,
  getReachablePlaySource,
  getStaticWebPlaySource,
  isGameReachable,
  type GameEntry
} from "../src/data/games";
import { validateCatalog } from "../src/lib/catalog";
import { isApprovedRelease } from "../src/lib/game-assets";
import MotionLabLauncher from "../src/pages/motion-lab/index.astro";
import MotionLabPlay from "../src/pages/motion-lab/play.astro";

const PREVIEW_VERSION = "0.1.0-ml-host-evidence.1";

const motionLab = (): GameEntry => {
  const game = getGame(MOTION_LAB_SLUG);
  if (!game) throw new Error("Motion Lab is missing from the catalog");
  return game;
};

/** Load the registry with a preview pointer configured, as a preview build would. */
async function importWithPreview(version: string) {
  vi.stubEnv("MOTION_LAB_PREVIEW_VERSION", version);
  vi.resetModules();
  return await import("../src/data/games");
}

describe("motion lab host identity", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is in the catalog as coming-soon with an ordered route and real controls", () => {
    const game = motionLab();

    expect(game.status).toBe("coming-soon");
    expect(game.route).toBe("/motion-lab/");
    expect(getGamePlayRoute(game)).toBe("/motion-lab/play/");
    expect(game.title).toBe("Motion Lab");
    expect(game.description.length).toBeGreaterThan(40);
    expect(game.controls.length).toBeGreaterThan(0);
  });

  it("keeps the whole catalog valid with the entry added", () => {
    expect(validateCatalog(games)).toEqual([]);
  });
});

describe("production selects no Motion Lab release", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("declares no production release and no preview pointer", () => {
    const game = motionLab();

    // There is no MOTION_LAB_PRODUCTION_VERSION constant either: a missing constant fails
    // to compile, which is a stronger guarantee than a placeholder.
    expect(game.release).toBeUndefined();
    expect(game.preview).toBeUndefined();
  });

  it("resolves no asset base, no play source, and is not reachable", () => {
    const game = motionLab();

    expect(getGameAssetBase(game)).toBeUndefined();
    expect(getStaticWebPlaySource(game)).toBeUndefined();
    expect(getReachablePlaySource(game)).toBeUndefined();
    expect(isGameReachable(game)).toBe(false);
  });

  it("does not advertise the play route from the collection", () => {
    // The collection only links playable entries, so an unfinished candidate cannot be
    // reached by browsing even though its play route exists as a page.
    const game = motionLab();
    expect(game.status === "playable").toBe(false);
  });

  it("renders the launcher with no pointer and honest unavailable copy", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(MotionLabLauncher, { partial: false });

    expect(html).toContain('data-slot="motion-lab-host-status"');
    expect(html).toContain('data-catalog-status="coming-soon"');
    expect(html).toContain('data-preview-pointer="none"');
    expect(html).toContain('data-preview-asset-base="none"');
    expect(html).toContain("No Motion Lab build is selected here.");
    // The promoted-play affordance must be absent, not merely relabelled.
    expect(html).not.toContain(">Play Motion Lab");
  });

  it("renders the play route as the shared unavailable panel, never a frame", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(MotionLabPlay, { partial: false });

    expect(html).toContain('class="not-ready-panel"');
    expect(html).toContain("The experiment bench is still being set up.");
    expect(html).not.toContain("<iframe");
    // No asset request may be emitted for an unapproved candidate.
    expect(html).not.toContain("game-assets");
    expect(html).not.toContain("data-play-fullscreen");
  });
});

describe("a supplied preview pointer is a candidate, not a promotion", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("still declares no production release while the candidate is configured", async () => {
    const { games: catalog, getGame: getPreviewGame } = await importWithPreview(PREVIEW_VERSION);
    const game = getPreviewGame(MOTION_LAB_SLUG)!;

    expect(game.status).toBe("coming-soon");
    expect(game.release).toBeUndefined();
    expect(game.preview).toEqual({ version: PREVIEW_VERSION, entryFile: "index.html" });
    expect(validateCatalog(catalog)).toEqual([]);
  });

  it("distinguishes the preview pointer from the production pointer", async () => {
    const games = await importWithPreview(PREVIEW_VERSION);
    const game = games.getGame(MOTION_LAB_SLUG)!;

    // The production accessor stays empty in the preview state. That is the whole point:
    // hosting a candidate must not populate the promoted-release pointer.
    expect(games.getStaticWebPlaySource(game)).toBeUndefined();
    expect(games.getGameAssetBase(game)).toBeUndefined();

    expect(games.getGamePreviewSource(game)).toEqual({
      assetBase: `/game-assets/${MOTION_LAB_SLUG}/${PREVIEW_VERSION}`,
      release: { kind: "static-web", version: PREVIEW_VERSION, entryFile: "index.html" }
    });
    expect(games.isGameReachable(game)).toBe(true);
  });

  it("renders the launcher pointer and a clearly-labelled candidate link", async () => {
    await importWithPreview(PREVIEW_VERSION);
    // Imported dynamically on purpose. A top-level static import would already have been
    // evaluated with the production environment, so the component would keep rendering the
    // no-pointer state and the test would pass for the wrong reason.
    const { default: Launcher } = await import("../src/pages/motion-lab/index.astro");
    const container = await AstroContainer.create();
    const html = await container.renderToString(Launcher, { partial: false });

    expect(html).toContain(`data-preview-pointer="${PREVIEW_VERSION}"`);
    expect(html).toContain(
      `data-preview-asset-base="/game-assets/${MOTION_LAB_SLUG}/${PREVIEW_VERSION}"`
    );
    expect(html).toContain("qualification candidate");
    // Labelled as a candidate. It must not read like a promoted game.
    expect(html).toContain("Open the qualification preview");
    expect(html).not.toContain(">Play Motion Lab");
  });

  it("frames exactly the nested entry document the game repository proved", async () => {
    await importWithPreview(PREVIEW_VERSION);
    const { default: Play } = await import("../src/pages/motion-lab/play.astro");
    const container = await AstroContainer.create();
    const html = await container.renderToString(Play, { partial: false });

    // This exact URL shape is what game-motion-lab's host lane serves and asserts
    // (tests/host/nestedAssetBase.spec.ts). If either side changes it, the other fails.
    expect(html).toContain(`src="/game-assets/${MOTION_LAB_SLUG}/${PREVIEW_VERSION}/index.html"`);
    expect(html).not.toContain('class="not-ready-panel"');
  });
});

describe("catalog invariants that keep the pointers distinct", () => {
  const base = (): GameEntry => ({ ...motionLab() });

  it("accepts a coming-soon entry carrying only a preview pointer", () => {
    const entry: GameEntry = {
      ...base(),
      preview: { version: "0.1.0", entryFile: "index.html" }
    };
    expect(validateCatalog([entry])).toEqual([]);
  });

  it("rejects a playable entry that also carries a preview pointer", () => {
    const entry: GameEntry = {
      ...base(),
      status: "playable",
      release: { kind: "static-web", version: "1.0.0", entryFile: "index.html" },
      preview: { version: "0.1.0", entryFile: "index.html" }
    };
    expect(validateCatalog([entry]).join("\n")).toContain("must not also carry a preview");
  });

  it("rejects an entry declaring both production and preview pointers", () => {
    const entry: GameEntry = {
      ...base(),
      release: { kind: "static-web", version: "1.0.0", entryFile: "index.html" },
      preview: { version: "0.1.0", entryFile: "index.html" }
    };
    const errors = validateCatalog([entry]).join("\n");
    expect(errors).toContain("coming-soon games cannot select a production release");
    expect(errors).toContain("must not declare both a production release and a preview");
  });

  it("still rejects a coming-soon entry with a production release", () => {
    const entry: GameEntry = {
      ...base(),
      release: { kind: "static-web", version: "1.0.0", entryFile: "index.html" }
    };
    expect(validateCatalog([entry]).join("\n")).toContain(
      "coming-soon games cannot select a production release"
    );
  });

  it("rejects previewEnabled on a promoted entry", () => {
    const entry: GameEntry = {
      ...base(),
      status: "playable",
      release: { kind: "static-web", version: "1.0.0", entryFile: "index.html" }
    };
    expect(validateCatalog([entry]).join("\n")).toContain("previewEnabled only applies");
  });

  it("rejects an unsafe preview entry file and version", () => {
    const traversal: GameEntry = {
      ...base(),
      preview: { version: "0.1.0", entryFile: "../index.html" }
    };
    const notHtml: GameEntry = {
      ...base(),
      preview: { version: "0.1.0", entryFile: "index.js" }
    };
    const unsafeVersion: GameEntry = {
      ...base(),
      preview: { version: "../escape", entryFile: "index.html" }
    };

    expect(validateCatalog([traversal]).join("\n")).toContain("safe relative asset path");
    expect(validateCatalog([notHtml]).join("\n")).toContain("must be an HTML document");
    expect(validateCatalog([unsafeVersion]).join("\n")).toContain("immutable path-safe identifier");
  });
});

describe("asset serving requires an exact approved pointer", () => {
  it("serves nothing for an unapproved candidate version", () => {
    expect(isApprovedRelease(MOTION_LAB_SLUG, PREVIEW_VERSION, false)).toBe(false);
    expect(isApprovedRelease(MOTION_LAB_SLUG, "0.1.0", false)).toBe(false);
  });

  it("serves only the exact version the deployment approved", () => {
    const withPointer = (version: string) =>
      isApprovedRelease(
        MOTION_LAB_SLUG,
        version,
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        PREVIEW_VERSION
      );

    expect(withPointer(PREVIEW_VERSION)).toBe(true);
    expect(withPointer("0.1.0")).toBe(false);
    expect(withPointer(`${PREVIEW_VERSION}-next`)).toBe(false);
  });

  it("cannot approve the game through the promoted-release fallback", () => {
    // The catalog fallback only approves a playable game's selected release. Motion Lab is
    // not playable and selects nothing, so no catalog state can approve it — only an exact
    // deployment pointer can. A deployment that forgets the pointer serves 404s rather than
    // serving an unqualified candidate.
    const promoted = games
      .filter((game) => game.slug === MOTION_LAB_SLUG)
      .every((game) => game.status !== "playable" || !game.release);
    expect(promoted).toBe(true);
  });
});

describe("route validation covers the preview-gated route", () => {
  // Page files must be supplied explicitly: with no discovered routes the registry route
  // itself is missing, and validateRoutes stops before the play-route checks.
  const launcherPage = join(process.cwd(), "src", "pages", MOTION_LAB_SLUG, "index.astro");
  const playPage = join(process.cwd(), "src", "pages", MOTION_LAB_SLUG, "play.astro");

  it("flags previewEnabled when the play page is missing", async () => {
    const { validateRoutes } = await import("../src/lib/routes");
    const entry: GameEntry = { ...motionLab(), previewEnabled: true };
    const result = validateRoutes({
      projectRoot: process.cwd(),
      catalog: [entry],
      pageFiles: [launcherPage]
    });

    expect(result.violations.map((violation) => violation.id)).toContain(
      "missing-preview-play-route"
    );
  });

  it("still flags a coming-soon game that exposes a play page without opting in", async () => {
    const { validateRoutes } = await import("../src/lib/routes");
    const entry: GameEntry = { ...motionLab(), previewEnabled: false };
    const result = validateRoutes({
      projectRoot: process.cwd(),
      catalog: [entry],
      pageFiles: [launcherPage, playPage]
    });

    expect(result.violations.map((violation) => violation.id)).toContain(
      "unavailable-game-play-route"
    );
  });

  it("accepts the preview-gated play route in the real repository tree", async () => {
    const { validateRoutes } = await import("../src/lib/routes");
    const result = validateRoutes({ projectRoot: process.cwd() });

    expect(result.violations).toEqual([]);
  });
});
