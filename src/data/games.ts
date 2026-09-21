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
const weatherCommandPreviewRelease: StaticWebRelease | undefined = weatherCommandPreviewVersion
  ? { kind: "static-web", version: weatherCommandPreviewVersion, entryFile: "index.html" }
  : undefined;
// Ecosystem Rescue is a qualification candidate: production keeps it coming-soon, and a preview
// build with the exact version pinned serves that immutable artifact. Merging this change does not
// publish the game; the preview environment is what renders it.
const ecosystemRescuePreviewRelease: StaticWebRelease | undefined = ecosystemRescuePreviewVersion
  ? { kind: "static-web", version: ecosystemRescuePreviewVersion, entryFile: "index.html" }
  : undefined;

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
    slug: "weather-command",
    title: "Weather Command",
    status: weatherCommandPreviewRelease ? "playable" : "coming-soon",
    eyebrow: "Read the atmosphere",
    description: weatherCommandPreviewRelease
      ? "Inspect atmospheric evidence, make a forecast, and compare your prediction with a simulated weather system in this qualification preview."
      : "A forecast desk is taking shape. Soon you’ll read atmospheric evidence, make a prediction, and see how the simulated weather responds.",
    cardImage: "/art/coming-soon.svg",
    route: "/weather-command/",
    controls: [
      { input: "Mouse / touch", action: "Inspect evidence and build a forecast" },
      { input: "Keyboard", action: "Navigate evidence and forecast controls" }
    ],
    ...(weatherCommandPreviewRelease ? { release: weatherCommandPreviewRelease } : {})
  },
  {
    slug: "ecosystem-rescue",
    title: "Ecosystem Rescue",
    status: ecosystemRescuePreviewRelease ? "playable" : "coming-soon",
    eyebrow: "Read the whole pond",
    description: ecosystemRescuePreviewRelease
      ? "Follow fertiliser from the fields into a pond: watch the algae bloom, the water cloud over, and the oxygen fall, then decide what to do about it. This candidate build is being tested before it joins the playable collection, and it says on screen which parts of the model it does not yet run."
      : "A pond is taking shape. Soon you’ll trace nutrients through a whole ecosystem, read the evidence, and decide what a struggling pond needs.",
    cardImage: "/art/coming-soon.svg",
    route: "/ecosystem-rescue/",
    controls: [
      { input: "Mouse / touch", action: "Advance days and take an intervention" },
      { input: "Keyboard", action: "Advance, intervene, and read the evidence table" }
    ],
    ...(ecosystemRescuePreviewRelease ? { release: ecosystemRescuePreviewRelease } : {})
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

export function getGamePlayRoute(game: GameEntry): string {
  return `${game.route}play/`;
}
