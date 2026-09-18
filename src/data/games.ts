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

// Pages preview builds may set this environment value to exercise a pinned
// candidate in R2. Production `main` leaves it unset, so Bridge Builder stays
// coming-soon until the independent approval gate is complete.
const runtimeProcess = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }
).process;
const bridgeBuilderPreviewVersion = runtimeProcess?.env?.BRIDGE_BUILDER_PREVIEW_VERSION;

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
    status: "coming-soon",
    eyebrow: "A quiet world in progress",
    description:
      "Tend a tiny landscape, follow its gentle signals, and discover what changes when you pay attention.",
    cardImage: "/art/signal-garden-card.svg",
    route: "/signal-garden/",
    controls: [
      { input: "Mouse", action: "Look and interact" },
      { input: "WASD", action: "Move" },
      { input: "Esc", action: "Pause or leave" }
    ]
  },
  {
    slug: "bridge-builder",
    title: "Bridge Builder",
    status: bridgeBuilderPreviewVersion ? "playable" : "coming-soon",
    eyebrow: "A thoughtful construction game",
    description:
      "Compose labeled planks so a bridge closes exactly. The candidate build is being tested before it joins the playable collection.",
    cardImage: "/art/bridge-builder-card.svg",
    route: "/bridge-builder/",
    controls: [
      { input: "Pointer or touch", action: "Select and place a plank" },
      { input: "Keyboard", action: "Move, place, undo, and check" },
      { input: "Reduce motion", action: "Use the calm presentation mode" }
    ],
    ...(bridgeBuilderPreviewVersion
      ? {
          release: {
            kind: "static-web" as const,
            version: bridgeBuilderPreviewVersion,
            entryFile: "index.html"
          }
        }
      : {})
  },
  {
    slug: "number-line-jumper",
    title: "Number Line Jumper",
    status: "coming-soon",
    eyebrow: "Number sense in motion",
    description:
      "Estimate, place, and explore values on a responsive number line across whole numbers, fractions, decimals, and negatives.",
    cardImage: "/art/coming-soon.svg",
    route: "/number-line-jumper/",
    controls: [
      { input: "Mouse / touch", action: "Place and explore" },
      { input: "Keyboard", action: "Place, move, and zoom" }
    ]
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
