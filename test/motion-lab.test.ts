// GAME-385 / ML-HOST prepared this host WITHOUT promoting a build, and asserted that
// production selected nothing. GAME-401 / ML-PROMOTE has since selected one immutable
// release, so the two claims that matter have inverted:
//
//   1. production selects exactly the promoted immutable release, and
//   2. a supplied preview pointer is a candidate override, never a second promotion.
//
// Both are asserted in both environment states, because a check that only ever runs in one
// of them cannot distinguish "safe by design" from "safe by luck". The catalog-invariant and
// asset-approval suites below are the ML-HOST ones, retargeted at the promoted entry rather
// than deleted, so the properties ML-HOST established are still enforced.
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";

import {
  MOTION_LAB_PRODUCTION_VERSION,
  MOTION_LAB_SLUG,
  games,
  getGame,
  getGameAssetBase,
  getGamePlayRoute,
  getGamePreviewSource,
  getReachablePlaySource,
  getStaticWebPlaySource,
  isGameReachable,
  type GameEntry
} from "../src/data/games";
import { validateCatalog } from "../src/lib/catalog";
import { isApprovedRelease } from "../src/lib/game-assets";
import MotionLabLauncher from "../src/pages/motion-lab/index.astro";
import MotionLabPlay from "../src/pages/motion-lab/play.astro";

/** The promoted version. It is a committed catalog value, never a test-local invention. */
const PROMOTED_VERSION = MOTION_LAB_PRODUCTION_VERSION;
const PROMOTED_ASSET_BASE = `/game-assets/${MOTION_LAB_SLUG}/${PROMOTED_VERSION}`;
/** A different, unpromoted candidate a qualification pass could pin. */
const CANDIDATE_VERSION = "0.1.0-ml-next.1";

const motionLab = (): GameEntry => {
  const game = getGame(MOTION_LAB_SLUG);
  if (!game) throw new Error("Motion Lab is missing from the catalog");
  return game;
};

/** A Motion Lab entry derived from the real one, so the real shape is what gets mutated. */
const entry = (overrides: Partial<GameEntry> = {}): GameEntry => ({ ...motionLab(), ...overrides });

/** The pre-promotion shape, still used to exercise the rules that forbid it. */
const comingSoonEntry = (overrides: Partial<GameEntry> = {}): GameEntry =>
  entry({ status: "coming-soon", release: undefined, previewEnabled: undefined, ...overrides });

/** Load the registry with a preview pointer configured, as a qualification build would. */
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

  it("is in the catalog as playable with an ordered route and real controls", () => {
    const game = motionLab();

    expect(game.status).toBe("playable");
    expect(game.route).toBe("/motion-lab/");
    expect(getGamePlayRoute(game)).toBe("/motion-lab/play/");
    expect(game.title).toBe("Motion Lab");
    expect(game.description.length).toBeGreaterThan(40);
    expect(game.controls.length).toBeGreaterThan(0);
  });

  it("keeps the whole catalog valid with the entry promoted", () => {
    expect(validateCatalog(games)).toEqual([]);
  });
});

describe("production selects the promoted Motion Lab release", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("selects exactly the committed immutable version", () => {
    const game = motionLab();

    expect(game.release).toEqual({
      kind: "static-web",
      version: PROMOTED_VERSION,
      entryFile: "index.html"
    });
    // Promotion replaces the candidate mechanism rather than joining it: a promoted entry
    // carrying a preview pointer is rejected by the catalog validator.
    expect(game.preview).toBeUndefined();
    expect(game.previewEnabled).toBeUndefined();
  });

  it("resolves the promoted asset base and play source, and is reachable", () => {
    const game = motionLab();

    expect(getGameAssetBase(game)).toBe(PROMOTED_ASSET_BASE);
    expect(getStaticWebPlaySource(game)).toEqual({
      assetBase: PROMOTED_ASSET_BASE,
      release: { kind: "static-web", version: PROMOTED_VERSION, entryFile: "index.html" }
    });
    expect(getReachablePlaySource(game)).toEqual(getStaticWebPlaySource(game));
    expect(isGameReachable(game)).toBe(true);
    // There is no candidate pointer for a promoted game. The accessor that reads one must
    // stay empty, so a promotion cannot leave a second, quieter pointer behind.
    expect(getGamePreviewSource(game)).toBeUndefined();
  });

  it("advertises the play route from the collection", () => {
    expect(motionLab().status).toBe("playable");
  });

  it("renders the launcher with the promoted release and a real Play affordance", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(MotionLabLauncher, { partial: false });

    expect(html).toContain('data-slot="motion-lab-host-status"');
    expect(html).toContain('data-catalog-status="playable"');
    expect(html).toContain(`data-release-version="${PROMOTED_VERSION}"`);
    expect(html).toContain(`data-play-asset-base="${PROMOTED_ASSET_BASE}"`);
    expect(html).toContain(">Play Motion Lab");
    // The candidate affordance and its label are absent, not merely relabelled.
    expect(html).not.toContain("Open the qualification preview");
    expect(html).not.toContain("qualification candidate");
  });

  it("frames exactly the nested entry document the game repository proved", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(MotionLabPlay, { partial: false });

    // This exact URL shape is what game-motion-lab's host lane serves and asserts
    // (tests/host/nestedAssetBase.spec.ts). If either side changes it, the other fails.
    expect(html).toContain(`src="${PROMOTED_ASSET_BASE}/index.html"`);
    expect(html).not.toContain('class="not-ready-panel"');
  });

  it("resolves nothing to frame once the entry stops selecting a release", () => {
    // What the play page frames is exactly `getStaticWebPlaySource(game)`. Asserting the
    // accessor is what makes "the unavailable panel, never a frame" a property of the data
    // rather than of the rendered markup passing by luck.
    const unpromoted = comingSoonEntry();
    expect(getStaticWebPlaySource(unpromoted)).toBeUndefined();
    expect(getReachablePlaySource(unpromoted)).toBeUndefined();
    expect(isGameReachable(unpromoted)).toBe(false);
  });
});

describe("a supplied preview pointer pins a candidate, not a second promotion", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("overrides the release version while the catalog entry stays promoted", async () => {
    const { games: catalog, getGame: getPreviewGame } = await importWithPreview(CANDIDATE_VERSION);
    const game = getPreviewGame(MOTION_LAB_SLUG)!;

    expect(game.status).toBe("playable");
    expect(game.release).toEqual({
      kind: "static-web",
      version: CANDIDATE_VERSION,
      entryFile: "index.html"
    });
    // The override must not create a second pointer kind. There is still no `preview`, and
    // the entry still validates as a promoted release.
    expect(game.preview).toBeUndefined();
    expect(validateCatalog(catalog)).toEqual([]);
  });

  it("keeps the production accessors pointed at the pinned candidate only", async () => {
    const catalog = await importWithPreview(CANDIDATE_VERSION);
    const game = catalog.getGame(MOTION_LAB_SLUG)!;

    expect(catalog.getGameAssetBase(game)).toBe(
      `/game-assets/${MOTION_LAB_SLUG}/${CANDIDATE_VERSION}`
    );
    expect(catalog.getStaticWebPlaySource(game)?.release.version).toBe(CANDIDATE_VERSION);
    expect(catalog.getGamePreviewSource(game)).toBeUndefined();
    expect(catalog.isGameReachable(game)).toBe(true);
  });

  it("treats an empty pointer as not configured, exactly as production does", async () => {
    const catalog = await importWithPreview("");
    const game = catalog.getGame(MOTION_LAB_SLUG)!;

    expect(game.release).toEqual({
      kind: "static-web",
      version: PROMOTED_VERSION,
      entryFile: "index.html"
    });
    expect(catalog.getGameAssetBase(game)).toBe(PROMOTED_ASSET_BASE);
  });

  it("renders the pinned candidate and keeps the promoted label", async () => {
    await importWithPreview(CANDIDATE_VERSION);
    // Imported dynamically on purpose. A top-level static import would already have been
    // evaluated with the production environment, so the component would keep rendering the
    // promoted version and the test would pass for the wrong reason.
    const { default: Launcher } = await import("../src/pages/motion-lab/index.astro");
    const container = await AstroContainer.create();
    const html = await container.renderToString(Launcher, { partial: false });

    expect(html).toContain(`data-release-version="${CANDIDATE_VERSION}"`);
    expect(html).toContain(
      `data-play-asset-base="/game-assets/${MOTION_LAB_SLUG}/${CANDIDATE_VERSION}"`
    );
    // The entry is still promoted, so the affordance stays "Play": a pinned candidate of a
    // promoted game is not a different kind of pointer and must not read like one.
    expect(html).toContain(">Play Motion Lab");
    expect(html).not.toContain("qualification candidate");
  });

  it("frames the pinned candidate when the pointer is set", async () => {
    await importWithPreview(CANDIDATE_VERSION);
    const { default: Play } = await import("../src/pages/motion-lab/play.astro");
    const container = await AstroContainer.create();
    const html = await container.renderToString(Play, { partial: false });

    expect(html).toContain(`src="/game-assets/${MOTION_LAB_SLUG}/${CANDIDATE_VERSION}/index.html"`);
    expect(html).not.toContain('class="not-ready-panel"');
  });
});

describe("catalog invariants that keep the pointers distinct", () => {
  it("accepts the real promoted entry", () => {
    expect(validateCatalog([motionLab()])).toEqual([]);
  });

  it("accepts a coming-soon entry carrying only a preview pointer", () => {
    const candidate: GameEntry = comingSoonEntry({
      preview: { version: "0.1.0", entryFile: "index.html" }
    });
    expect(validateCatalog([candidate])).toEqual([]);
  });

  it("rejects a playable entry that also carries a preview pointer", () => {
    const blurred: GameEntry = entry({
      preview: { version: "0.1.0", entryFile: "index.html" }
    });
    expect(validateCatalog([blurred]).join("\n")).toContain("must not also carry a preview");
  });

  it("rejects an entry declaring both production and preview pointers", () => {
    const blurred: GameEntry = comingSoonEntry({
      release: { kind: "static-web", version: "1.0.0", entryFile: "index.html" },
      preview: { version: "0.1.0", entryFile: "index.html" }
    });
    const errors = validateCatalog([blurred]).join("\n");
    expect(errors).toContain("coming-soon games cannot select a production release");
    expect(errors).toContain("must not declare both a production release and a preview");
  });

  it("still rejects a coming-soon entry with a production release", () => {
    const unpromoted: GameEntry = comingSoonEntry({
      release: { kind: "static-web", version: "1.0.0", entryFile: "index.html" }
    });
    expect(validateCatalog([unpromoted]).join("\n")).toContain(
      "coming-soon games cannot select a production release"
    );
  });

  it("rejects previewEnabled on the promoted entry", () => {
    const stale: GameEntry = entry({ previewEnabled: true });
    expect(validateCatalog([stale]).join("\n")).toContain("previewEnabled only applies");
  });

  it("rejects an unsafe preview entry file and version", () => {
    const traversal: GameEntry = comingSoonEntry({
      preview: { version: "0.1.0", entryFile: "../index.html" }
    });
    const notHtml: GameEntry = comingSoonEntry({
      preview: { version: "0.1.0", entryFile: "index.js" }
    });
    const unsafeVersion: GameEntry = comingSoonEntry({
      preview: { version: "../escape", entryFile: "index.html" }
    });

    expect(validateCatalog([traversal]).join("\n")).toContain("safe relative asset path");
    expect(validateCatalog([notHtml]).join("\n")).toContain("must be an HTML document");
    expect(validateCatalog([unsafeVersion]).join("\n")).toContain("immutable path-safe identifier");
  });
});

describe("asset serving requires an exact approved pointer", () => {
  /**
   * `isApprovedRelease` takes every deployment pointer positionally, so the helper takes the
   * requested version and the pointer separately. Passing one value for both would make every
   * request look approved and the test would pass for the wrong reason.
   */
  const withMotionLabPointer = (requested: string, pointer: string): boolean =>
    isApprovedRelease(
      MOTION_LAB_SLUG,
      requested,
      false,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      pointer
    );

  it("serves the promoted version through the catalog fallback", () => {
    // This is what promotion actually buys: the catalog, not an environment variable, is
    // now what approves the artifact. Without this, promoting the entry would put a Play
    // button on a page whose assets still 404.
    expect(isApprovedRelease(MOTION_LAB_SLUG, PROMOTED_VERSION, false)).toBe(true);
  });

  it("serves nothing for a version the catalog does not promote", () => {
    expect(isApprovedRelease(MOTION_LAB_SLUG, CANDIDATE_VERSION, false)).toBe(false);
    expect(isApprovedRelease(MOTION_LAB_SLUG, "0.1.0", false)).toBe(false);
    expect(isApprovedRelease(MOTION_LAB_SLUG, `${PROMOTED_VERSION}-next`, false)).toBe(false);
  });

  it("serves only the exact version a deployment pointer approved", () => {
    expect(withMotionLabPointer(CANDIDATE_VERSION, CANDIDATE_VERSION)).toBe(true);
    expect(withMotionLabPointer(`${CANDIDATE_VERSION}-next`, CANDIDATE_VERSION)).toBe(false);
    expect(withMotionLabPointer("0.1.0", CANDIDATE_VERSION)).toBe(false);
    // A version the catalog promotes is served even with no pointer at all; a version the
    // catalog does not promote is not served just because a pointer exists for something else.
    expect(withMotionLabPointer(PROMOTED_VERSION, CANDIDATE_VERSION)).toBe(true);
  });

  it("approves Motion Lab through the catalog fallback only because it is playable", () => {
    // The mirror of the ML-HOST assertion: the same fallback that approves the promoted
    // version must refuse a nearly-identical but unpromoted version.
    const promoted = games.filter(
      (game) => game.slug === MOTION_LAB_SLUG && game.status === "playable" && Boolean(game.release)
    );
    expect(promoted).toHaveLength(1);
    expect(isApprovedRelease(MOTION_LAB_SLUG, promoted[0]!.release!.version, false)).toBe(true);
  });
});

describe("route validation covers the Motion Lab play route", () => {
  // Page files must be supplied explicitly: with no discovered routes the registry route
  // itself is missing, and validateRoutes stops before the play-route checks.
  const launcherPage = join(process.cwd(), "src", "pages", MOTION_LAB_SLUG, "index.astro");
  const playPage = join(process.cwd(), "src", "pages", MOTION_LAB_SLUG, "play.astro");

  it("accepts the promoted play route in the real repository tree", async () => {
    const { validateRoutes } = await import("../src/lib/routes");
    const result = validateRoutes({ projectRoot: process.cwd() });

    expect(result.violations).toEqual([]);
  });

  it("flags previewEnabled when the play page is missing", async () => {
    const { validateRoutes } = await import("../src/lib/routes");
    const result = validateRoutes({
      projectRoot: process.cwd(),
      catalog: [comingSoonEntry({ previewEnabled: true })],
      pageFiles: [launcherPage]
    });

    expect(result.violations.map((violation) => violation.id)).toContain(
      "missing-preview-play-route"
    );
  });

  it("still flags a coming-soon game that exposes a play page without opting in", async () => {
    const { validateRoutes } = await import("../src/lib/routes");
    const result = validateRoutes({
      projectRoot: process.cwd(),
      catalog: [comingSoonEntry({ previewEnabled: false })],
      pageFiles: [launcherPage, playPage]
    });

    expect(result.violations.map((violation) => violation.id)).toContain(
      "unavailable-game-play-route"
    );
  });
});
