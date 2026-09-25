export type GameStatus = "coming-soon" | "playable";

export interface GameControl {
  input: string;
  action: string;
}

interface GameReleaseBase {
  version: string;
}

export interface UnityWebglRelease extends GameReleaseBase {
  kind: "unity-webgl";
  loaderFile: string;
  dataFile: string;
  frameworkFile: string;
  wasmFile: string;
}

export interface StaticWebRelease extends GameReleaseBase {
  kind: "static-web";
  entryFile: string;
}

export type GameRelease = UnityWebglRelease | StaticWebRelease;

export const BRIDGE_BUILDER_PRODUCTION_VERSION = "0.1.0-qualification.12";
export const NUMBER_LINE_JUMPER_PRODUCTION_VERSION = "main-12641c0";
export const MATH_DETECTIVE_PRODUCTION_VERSION = "2026.09.21-playtest-enhancements.1";
export const ECOSYSTEM_RESCUE_PRODUCTION_VERSION = "0.1.0-qualification.6";
export const WEATHER_COMMAND_PRODUCTION_VERSION = "0.1.0-qualification.2";
export const FRACTION_MATCH_PRODUCTION_VERSION = "0.1.0-qualification.1";

/**
 * Planetary Survey has NO production version, deliberately.
 *
 * GAME-365 / PS-HOST exists to prepare the host for this game without promoting an
 * unfinished build. There is no `PLANETARY_SURVEY_PRODUCTION_VERSION` constant
 * because there is no promoted release: the entry stays `coming-soon` and carries no
 * `release` at all until PS-PROMOTE selects an immutable artifact through a reviewed
 * catalog change.
 *
 * A missing constant is a stronger guarantee than a placeholder one. Any code that
 * needs a production pointer for this game fails to compile rather than silently
 * reading a version nobody qualified.
 */
export const PLANETARY_SURVEY_SLUG = "planetary-survey";

/**
 * Motion Lab has NO production version, deliberately.
 *
 * GAME-385 / ML-HOST exists to prepare the host for this game without promoting an
 * unfinished build. There is no `MOTION_LAB_PRODUCTION_VERSION` constant for the same
 * reason Planetary Survey has none: a missing constant fails to compile, which is a
 * stronger guarantee than a placeholder version nobody qualified. The entry stays
 * `coming-soon` and carries no `release` until ML-PROMOTE selects an immutable artifact
 * through a reviewed catalog change.
 */
export const MOTION_LAB_SLUG = "motion-lab";

// Production selects the approved immutable release directly. Pages preview
// builds may override the version to exercise a different pinned candidate.
const runtimeProcess = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }
).process;
const bridgeBuilderPreviewVersion = runtimeProcess?.env?.BRIDGE_BUILDER_PREVIEW_VERSION;
const numberLineJumperPreviewVersion = runtimeProcess?.env?.NUMBER_LINE_JUMPER_PREVIEW_VERSION;
const mathDetectivePreviewVersion = runtimeProcess?.env?.MATH_DETECTIVE_PREVIEW_VERSION;
const weatherCommandPreviewVersion = runtimeProcess?.env?.WEATHER_COMMAND_PREVIEW_VERSION;
const ecosystemRescuePreviewVersion = runtimeProcess?.env?.ECOSYSTEM_RESCUE_PREVIEW_VERSION;
const fractionMatchPreviewVersion = runtimeProcess?.env?.FRACTION_MATCH_PREVIEW_VERSION;
// The only Planetary Survey pointer that can exist before promotion. It is a
// PREVIEW pointer, never a production one: see `getGamePreviewSource`.
const planetarySurveyPreviewVersion = runtimeProcess?.env?.PLANETARY_SURVEY_PREVIEW_VERSION;
// Motion Lab's only pre-promotion pointer, for the same reason.
const motionLabPreviewVersion = runtimeProcess?.env?.MOTION_LAB_PREVIEW_VERSION;
const bridgeBuilderProductionRelease: StaticWebRelease = {
  kind: "static-web",
  version: BRIDGE_BUILDER_PRODUCTION_VERSION,
  entryFile: "index.html"
};
const bridgeBuilderRelease: StaticWebRelease = bridgeBuilderPreviewVersion
  ? { ...bridgeBuilderProductionRelease, version: bridgeBuilderPreviewVersion }
  : bridgeBuilderProductionRelease;
const numberLineJumperProductionRelease: StaticWebRelease = {
  kind: "static-web",
  version: NUMBER_LINE_JUMPER_PRODUCTION_VERSION,
  entryFile: "index.html"
};
const numberLineJumperRelease: StaticWebRelease = numberLineJumperPreviewVersion
  ? { ...numberLineJumperProductionRelease, version: numberLineJumperPreviewVersion }
  : numberLineJumperProductionRelease;
const mathDetectiveProductionRelease: StaticWebRelease = {
  kind: "static-web",
  version: MATH_DETECTIVE_PRODUCTION_VERSION,
  entryFile: "index.html"
};
const mathDetectiveRelease: StaticWebRelease = mathDetectivePreviewVersion
  ? { ...mathDetectiveProductionRelease, version: mathDetectivePreviewVersion }
  : mathDetectiveProductionRelease;
const weatherCommandProductionRelease: StaticWebRelease = {
  kind: "static-web",
  version: WEATHER_COMMAND_PRODUCTION_VERSION,
  entryFile: "index.html"
};
const weatherCommandRelease: StaticWebRelease = weatherCommandPreviewVersion
  ? { ...weatherCommandProductionRelease, version: weatherCommandPreviewVersion }
  : weatherCommandProductionRelease;
// Ecosystem Rescue's release: production selects the promoted immutable version, and a preview
// build can pin a different candidate for qualification. The catalog entry is playable either way,
// which is what makes the promoted version reachable at /ecosystem-rescue/play/ in production.
const ecosystemRescueProductionRelease: StaticWebRelease = {
  kind: "static-web",
  version: ECOSYSTEM_RESCUE_PRODUCTION_VERSION,
  entryFile: "index.html"
};
const ecosystemRescueRelease: StaticWebRelease = ecosystemRescuePreviewVersion
  ? { ...ecosystemRescueProductionRelease, version: ecosystemRescuePreviewVersion }
  : ecosystemRescueProductionRelease;
const fractionMatchProductionRelease: StaticWebRelease = {
  kind: "static-web",
  version: FRACTION_MATCH_PRODUCTION_VERSION,
  entryFile: "index.html"
};
const fractionMatchRelease: StaticWebRelease = fractionMatchPreviewVersion
  ? { ...fractionMatchProductionRelease, version: fractionMatchPreviewVersion }
  : fractionMatchProductionRelease;

/**
 * A qualification-only candidate pointer for a game that is NOT promoted.
 *
 * This is deliberately NOT a `GameRelease`. A `release` means "the catalog promotes
 * this exact version to production", and `validateCatalog` rejects a `release` on a
 * `coming-soon` entry for exactly that reason. A preview pointer means the opposite:
 * "a hosted qualification build exists, and production must not use it".
 *
 * Keeping them different types is what makes the two pointers impossible to confuse.
 * If they shared a shape, a preview version would eventually be promoted by accident.
 */
export interface GamePreview {
  readonly version: string;
  readonly entryFile: string;
}

export interface GameEntry {
  slug: string;
  title: string;
  status: GameStatus;
  eyebrow: string;
  description: string;
  cardImage: string;
  route: string;
  controls: readonly GameControl[];
  release?: GameRelease;
  /**
   * Hosted qualification candidate. Only meaningful for a `coming-soon` entry, and
   * only present when an explicit preview pointer is configured for this build.
   */
  preview?: GamePreview;
  /**
   * Declares that this game's play page is preview-gated rather than promoted.
   *
   * Present so route validation can stay STATIC. The alternative — asking whether a
   * preview is configured — depends on deployment environment, so a production build
   * would validate differently from a preview build, which is precisely the kind of
   * drift this repository's checks exist to prevent. This flag is a reviewable source
   * statement; the runtime guarantee that production cannot render the candidate is
   * enforced by `getGamePreviewSource` and asserted by tests in both environment
   * states.
   */
  previewEnabled?: boolean;
}

export const games: readonly GameEntry[] = [
  {
    slug: "signal-garden",
    title: "Signal Garden",
    status: "playable",
    eyebrow: "A quiet world in progress",
    description:
      "Tend a tiny landscape, follow its gentle signals, and discover what changes when you pay attention.",
    cardImage: "/art/signal-garden-card.svg",
    route: "/signal-garden/",
    controls: [
      { input: "Mouse", action: "Look and interact" },
      { input: "WASD", action: "Move" },
      { input: "Esc", action: "Pause or leave" }
    ],
    release: {
      kind: "unity-webgl",
      version: "2026-09-21-58f2c29",
      loaderFile: "WebGL.loader.js",
      dataFile: "WebGL.data.br",
      frameworkFile: "WebGL.framework.js.br",
      wasmFile: "WebGL.wasm.br"
    }
  },
  {
    slug: "bridge-builder",
    title: "Bridge Builder",
    status: "playable",
    eyebrow: "A thoughtful construction game",
    description: "Choose planks, close each gap exactly, and send the car safely across.",
    cardImage: "/art/bridge-builder-card.svg",
    route: "/bridge-builder/",
    controls: [
      { input: "Pointer or touch", action: "Select and place a plank" },
      { input: "Keyboard", action: "Move, place, undo, and check" },
      { input: "Reduce motion", action: "Use the calm presentation mode" }
    ],
    release: bridgeBuilderRelease
  },
  {
    slug: "number-line-jumper",
    title: "Number Line Jumper",
    status: "playable",
    eyebrow: "Number sense in motion",
    description: numberLineJumperPreviewVersion
      ? "Estimate, place, and explore values on a responsive number line across whole numbers, fractions, decimals, and negatives. This candidate build is being tested before it joins the playable collection."
      : "Estimate, place, and explore values on a responsive number line across whole numbers, fractions, decimals, and negatives.",
    cardImage: "/art/coming-soon.svg",
    route: "/number-line-jumper/",
    controls: [
      { input: "Mouse / touch", action: "Place and explore" },
      { input: "Keyboard", action: "Place, move, and zoom" }
    ],
    release: numberLineJumperRelease
  },
  {
    slug: "math-detective",
    title: "Math Detective",
    status: "playable",
    eyebrow: "A case file for curious minds",
    description: "Follow the clues, solve the math, and crack the case.",
    cardImage: "/art/math-detective-card.svg",
    route: "/math-detective/",
    controls: [
      { input: "Mouse / touch", action: "Inspect evidence and choose" },
      { input: "Keyboard", action: "Move through the case file" },
      { input: "Read aloud", action: "Hear goals and hints when available" }
    ],
    release: mathDetectiveRelease
  },
  {
    slug: "fraction-match",
    title: "Fraction Match",
    status: "playable",
    eyebrow: "Same amount, different faces",
    description: fractionMatchPreviewVersion
      ? "Turn two cards that show the same amount, even when the pictures look different. This candidate build is being tested before it joins the collection."
      : "Turn two cards that show the same amount, even when the pictures look different.",
    cardImage: "/art/fraction-match-card.svg",
    route: "/fraction-match/",
    controls: [
      { input: "Mouse / touch", action: "Turn a card and look for its match" },
      { input: "Keyboard", action: "Move between cards and select" },
      { input: "Reduce motion", action: "Keep the inspection window, skip the decoration" }
    ],
    release: fractionMatchRelease
  },
  {
    slug: "weather-command",
    title: "Weather Command",
    status: "playable",
    eyebrow: "Read the atmosphere",
    description: weatherCommandPreviewVersion
      ? "Inspect atmospheric evidence, make a forecast, and compare your prediction with a simulated weather system in this qualification preview."
      : "Inspect atmospheric evidence, make a forecast, and compare your prediction with a simulated weather system.",
    cardImage: "/art/coming-soon.svg",
    route: "/weather-command/",
    controls: [
      { input: "Mouse / touch", action: "Inspect evidence and build a forecast" },
      { input: "Keyboard", action: "Navigate evidence and forecast controls" }
    ],
    release: weatherCommandRelease
  },
  {
    slug: "ecosystem-rescue",
    title: "Ecosystem Rescue",
    status: "playable",
    eyebrow: "Read the whole pond",
    description: ecosystemRescuePreviewVersion
      ? "Follow fertiliser from the fields into a pond: watch the algae bloom, the water cloud over, and the animals that need the most oxygen feel it first, then decide what to do about it. This candidate build is being tested before it joins the collection."
      : "Follow fertiliser from the fields into a pond: watch the algae bloom, the water cloud over, and the animals that need the most oxygen feel it first, then decide what to do about it.",
    cardImage: "/art/ecosystem-rescue-card.svg",
    route: "/ecosystem-rescue/",
    controls: [
      { input: "Mouse / touch", action: "Advance days and take an intervention" },
      { input: "Keyboard", action: "Advance, intervene, and read the evidence table" }
    ],
    release: ecosystemRescueRelease
  },
  {
    slug: PLANETARY_SURVEY_SLUG,
    title: "Planetary Survey",
    status: "coming-soon",
    eyebrow: "Read the worlds next door",
    description: planetarySurveyPreviewVersion
      ? "Run a planetary survey: measure worlds, keep the evidence, compare them, and make a claim the data can back up. This qualification candidate is being tested before it joins the collection."
      : "Run a planetary survey: measure worlds, keep the evidence, compare them, and make a claim the data can back up.",
    cardImage: "/art/coming-soon.svg",
    route: "/planetary-survey/",
    controls: [
      { input: "Pointer or touch", action: "Approach a world and choose an instrument" },
      { input: "Keyboard", action: "Take every measurement and cite every claim" },
      { input: "Reduce motion", action: "Keep the evidence, skip the animation" }
    ],
    // Present only when this build was given a preview pointer. No `release` is ever
    // set here: promotion is a separate, reviewed change owned by PS-PROMOTE.
    ...(planetarySurveyPreviewVersion
      ? { preview: { version: planetarySurveyPreviewVersion, entryFile: "index.html" } }
      : {}),
    previewEnabled: true
  },
  {
    slug: MOTION_LAB_SLUG,
    title: "Motion Lab",
    status: "coming-soon",
    eyebrow: "Design the experiment, not the answer",
    description: motionLabPreviewVersion
      ? "Run controlled experiments with a cart and a track: change one thing, measure what happens, compare trials, and back your claim with evidence. This qualification candidate is being tested before it joins the collection."
      : "Run controlled experiments with a cart and a track: change one thing, measure what happens, compare trials, and back your claim with evidence.",
    cardImage: "/art/coming-soon.svg",
    route: "/motion-lab/",
    controls: [
      { input: "Pointer or touch", action: "Set up a run and record a trial" },
      { input: "Keyboard", action: "Take every reading and cite every claim" },
      { input: "Reduce motion", action: "Keep the measurement, skip the animation" }
    ],
    // Present only when this build was given a preview pointer. No `release` is ever set
    // here: promotion is a separate, reviewed change owned by ML-PROMOTE.
    ...(motionLabPreviewVersion
      ? { preview: { version: motionLabPreviewVersion, entryFile: "index.html" } }
      : {}),
    previewEnabled: true
  },
  {
    slug: "new-world-01",
    title: "A new world is growing",
    status: "coming-soon",
    eyebrow: "Next in the collection",
    description: "Another small place is taking shape. Its first light will arrive soon.",
    cardImage: "/art/coming-soon.svg",
    route: "/new-world-01/",
    controls: []
  },
  {
    slug: "new-world-02",
    title: "Something curious is coming",
    status: "coming-soon",
    eyebrow: "More to explore",
    description: "A new experiment is waiting just beyond the edge of the map.",
    cardImage: "/art/coming-soon.svg",
    route: "/new-world-02/",
    controls: []
  }
];

export function getGame(slug: string): GameEntry | undefined {
  return games.find((game) => game.slug === slug);
}

export function getPlayableGame(slug: string): GameEntry | undefined {
  const game = getGame(slug);
  return game?.status === "playable" ? game : undefined;
}

export function getGameAssetBase(game: GameEntry): string | undefined {
  if (game.status !== "playable" || !game.release) return undefined;
  return `/game-assets/${game.slug}/${game.release.version}`;
}

export interface GamePlaySource<TRelease extends GameRelease = GameRelease> {
  assetBase: string;
  release: TRelease;
}

// Play routes must not launch a build the catalog has not promoted, so the
// readiness check lives here instead of being repeated in every play page.
export function getStaticWebPlaySource(
  game: GameEntry
): GamePlaySource<StaticWebRelease> | undefined {
  const assetBase = getGameAssetBase(game);
  const release = game.release;
  if (!assetBase || release?.kind !== "static-web") return undefined;
  return { assetBase, release };
}

export function getUnityWebglPlaySource(
  game: GameEntry
): GamePlaySource<UnityWebglRelease> | undefined {
  const assetBase = getGameAssetBase(game);
  const release = game.release;
  if (!assetBase || release?.kind !== "unity-webgl") return undefined;
  return { assetBase, release };
}

export function getGamePlayRoute(game: GameEntry): string {
  return `${game.route}play/`;
}

/**
 * The hosted qualification candidate, if this build was given one.
 *
 * Returns `undefined` for a promoted game on purpose. A game with a `release` already
 * has an authoritative production pointer, and letting a preview override it is the
 * confusion this function exists to prevent — the older `*_PREVIEW_VERSION` mechanism
 * swaps the PRODUCTION version of an already-promoted game, which is a different and
 * riskier thing than hosting a candidate that is not promoted at all.
 */
export function getGamePreviewSource(
  game: GameEntry
): GamePlaySource<StaticWebRelease> | undefined {
  if (game.status !== "coming-soon") return undefined;
  const preview = game.preview;
  if (!preview) return undefined;
  return {
    assetBase: `/game-assets/${game.slug}/${preview.version}`,
    release: { kind: "static-web", version: preview.version, entryFile: preview.entryFile }
  };
}

/**
 * What a play page may actually run, in priority order.
 *
 * A promoted release wins; otherwise a configured qualification candidate; otherwise
 * nothing, and the play page renders the shared unavailable panel. Because the two
 * sources are disjoint by construction (a promoted game has no preview), this can
 * never return a candidate pointer for a promoted game, and production — which sets
 * no preview pointer — always falls through to `undefined`.
 */
export function getReachablePlaySource(
  game: GameEntry
): GamePlaySource<StaticWebRelease> | undefined {
  return getStaticWebPlaySource(game) ?? getGamePreviewSource(game);
}

/** True when this entry would run something in the CURRENT build environment. */
export function isGameReachable(game: GameEntry): boolean {
  return getReachablePlaySource(game) !== undefined;
}
