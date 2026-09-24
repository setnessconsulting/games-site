import { existsSync, readdirSync, readFileSync, type Dirent } from "node:fs";
import { join } from "node:path";

import { getGamePlayRoute, games, type GameEntry } from "../data/games";

/**
 * Static internal route/link integrity validation.
 *
 * The site is a fully static Astro build (output: "static", format: "directory"),
 * so every internal URL resolves to a filesystem path under the project root:
 *
 *   /                -> src/pages/index.astro
 *   /<slug>/         -> src/pages/<slug>/index.astro
 *   /<slug>/play/    -> src/pages/<slug>/play.astro
 *   /game-assets/... -> Pages Function (functions/game-assets/[[path]].ts), routed
 *                       via public/_routes.json (include: ["/game-assets/*"])
 *
 * That makes internal link integrity statically checkable without launching a
 * browser or dev server. This module derives the route model from the actual
 * src/pages tree plus the public/_routes.json function manifest, then validates
 * every internal route/link emitted by the games registry and shared components.
 *
 * Anchor fragments (#collection) are page-relative and are not resolved against
 * page content; their path portion is still validated.
 *
 * Intentional targets that live outside src/pages are declared in
 * INTENTIONAL_ROUTES with a reason instead of being special-cased inline.
 */

const ANCHOR_PATTERN = /^#[A-Za-z0-9_-]+$/;
const INTERNAL_ROUTE_PATTERN = /^\/(?:[a-z0-9._~-]+\/)*$/;
const MAX_ROUTE_SEGMENTS = 10;

/** A page or function target on the site, as opposed to a bare directory route. */
function isInternalTarget(href: string): boolean {
  return (
    href.startsWith("/") && !href.includes("//") && !href.includes("\\") && !href.includes("?")
  );
}

/**
 * Intentional internal targets that are not src/pages files. Keep reasons here:
 * each entry documents why a route is valid even though no page generates it.
 * When a coming-soon game gets its launcher page, remove its entry below.
 */
const INTENTIONAL_ROUTES: readonly { route: string; reason: string }[] = [
  {
    route: "/new-world-01/",
    reason: "coming-soon teaser; launcher page intentionally not published yet"
  },
  {
    route: "/new-world-02/",
    reason: "coming-soon teaser; launcher page intentionally not published yet"
  }
];

/** Intentional non-page routes accepted by validation, exposed for tooling output. */
export const intentionalRoutes: readonly { route: string; reason: string }[] = INTENTIONAL_ROUTES;

export type ViolationId =
  | "malformed-route"
  | "duplicate-route"
  | "conflicting-route"
  | "missing-route"
  | "missing-play-route"
  | "unavailable-game-play-route"
  | "missing-preview-play-route";

export interface Violation {
  /** Machine-stable check id, e.g. "missing-route". */
  readonly id: ViolationId;
  /** Which catalog entry, component, or page produced the link. */
  readonly source: string;
  /** The offending internal href. */
  readonly href: string;
  /** One-line, actionable explanation. */
  readonly message: string;
}

export interface RouteValidationResult {
  readonly violations: readonly Violation[];
  /** Number of site routes discovered under src/pages. */
  readonly routeCount: number;
  /** Internal prefixes served by Pages Functions per public/_routes.json. */
  readonly functionRoutes: readonly string[];
  /** Non-fatal observations, e.g. unreadable _routes.json. */
  readonly notes: readonly string[];
}

export interface RoutesOptions {
  /** Project root containing src/pages and public/. Defaults to process.cwd(). */
  readonly projectRoot?: string;
  /** Catalog entries to validate. Defaults to the real games registry. */
  readonly catalog?: readonly GameEntry[];
  /** Page files to derive routes from. Defaults to walking src/pages. */
  readonly pageFiles?: readonly string[];
  /** Extra static internal links to check alongside the built-in navigation set. */
  readonly extraStaticLinks?: readonly { source: string; href: string }[];
}

function toPosix(value: string): string {
  return value.split("\\").join("/");
}

function stripExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/** Map a src/pages file to the route Astro generates with build.format: "directory". */
function siteRouteFromPageFile(pageRootPosix: string, filePosix: string): string | undefined {
  let relative = toPosix(filePosix).slice(pageRootPosix.length);
  if (!relative.startsWith("/")) relative = `/${relative}`;

  const fileName = relative.slice(relative.lastIndexOf("/") + 1);
  // Underscore-prefixed pages are excluded from routing by Astro convention.
  if (fileName.startsWith("_")) return undefined;

  const directory = relative.slice(0, relative.lastIndexOf("/"));
  if (fileName === "index.astro" || fileName === "index.md") {
    return directory === "" ? "/" : `${directory}/`;
  }
  return `${directory}/${stripExtension(fileName)}/`;
}

function walkPageFiles(dir: string, out: string[]): void {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkPageFiles(full, out);
    } else if (entry.name.endsWith(".astro") || entry.name.endsWith(".md")) {
      out.push(full);
    }
  }
}

/** Reduce a _routes.json glob pattern such as "/game-assets/*" to "/game-assets/". */
function routePrefixFromGlob(pattern: string): string {
  return `/${pattern.replace(/^\/+/, "")}`.replace(/\*.*$/, "").replace(/\/+$/, "/");
}

interface FunctionRoutePrefixes {
  readonly include: readonly string[];
  readonly exclude: readonly string[];
}

function readFunctionRoutePrefixes(projectRoot: string, notes: string[]): FunctionRoutePrefixes {
  const manifestPath = join(projectRoot, "public", "_routes.json");
  if (!existsSync(manifestPath)) return { include: [], exclude: [] };

  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      include?: unknown;
      exclude?: unknown;
    };
    const asStrings = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    return {
      include: asStrings(parsed.include).map(routePrefixFromGlob),
      exclude: asStrings(parsed.exclude).map(routePrefixFromGlob)
    };
  } catch {
    notes.push("could not parse public/_routes.json; Pages Function routes are unknown");
    return { include: [], exclude: [] };
  }
}

function isServedByFunction(href: string, functionPrefixes: FunctionRoutePrefixes): boolean {
  const included = functionPrefixes.include.some((prefix) => href.startsWith(prefix));
  const excluded = functionPrefixes.exclude.some((prefix) => href.startsWith(prefix));
  return included && !excluded;
}

/**
 * Validate registry routes, play routes, unavailable-game targets, static
 * navigation links, and duplicate/conflicting routes against the discovered
 * static route model.
 */
export function validateRoutes(options: RoutesOptions = {}): RouteValidationResult {
  const projectRoot = toPosix(options.projectRoot ?? process.cwd());
  const pageRootPosix = toPosix(join(projectRoot, "src", "pages"));

  const pageFiles = options.pageFiles
    ? options.pageFiles.map(toPosix)
    : (() => {
        const found: string[] = [];
        walkPageFiles(join(projectRoot, "src", "pages"), found);
        return found;
      })();

  const routes = new Set<string>();
  for (const file of pageFiles) {
    const route = siteRouteFromPageFile(pageRootPosix, file);
    if (route) routes.add(route);
  }

  const notes: string[] = [];
  const functionPrefixes = readFunctionRoutePrefixes(projectRoot, notes);
  const functionRoutes = functionPrefixes.include;
  const intentional = new Map(INTENTIONAL_ROUTES.map((entry) => [entry.route, entry.reason]));
  const catalog = options.catalog ?? games;
  const violations: Violation[] = [];

  const routeExists = (href: string): boolean =>
    routes.has(href) || intentional.has(href) || isServedByFunction(href, functionPrefixes);

  // --- Registry routes: format, uniqueness, existence -------------------------
  const routeOwner = new Map<string, string>();
  const playRoutes = new Set<string>();
  // Routes already reported as broken at the registry level; downstream links to
  // them are suppressed so the actionable root cause is reported exactly once.
  const reportedRegistryRoutes = new Set<string>();
  for (const game of catalog) {
    if (typeof game.route === "string" && INTERNAL_ROUTE_PATTERN.test(game.route)) {
      playRoutes.add(getGamePlayRoute(game));
    }
  }

  for (const game of catalog) {
    if (typeof game.route !== "string" || !INTERNAL_ROUTE_PATTERN.test(game.route)) {
      violations.push({
        id: "malformed-route",
        source: game.slug,
        href: String(game.route),
        message: `configured route "${String(game.route)}" is malformed; use an absolute lowercase directory route like "/${game.slug}/"`
      });
      reportedRegistryRoutes.add(String(game.route));
      continue;
    }

    // Traversal routes pass the shape regex but must never be emitted.
    if (game.route.includes("..")) {
      violations.push({
        id: "malformed-route",
        source: game.slug,
        href: game.route,
        message: `configured route "${game.route}" is malformed; route segments must not contain traversal ("..")`
      });
      reportedRegistryRoutes.add(game.route);
      continue;
    }

    const segmentCount = game.route.split("/").filter(Boolean).length;
    if (segmentCount > MAX_ROUTE_SEGMENTS) {
      violations.push({
        id: "malformed-route",
        source: game.slug,
        href: game.route,
        message: `configured route "${game.route}" has more than ${MAX_ROUTE_SEGMENTS} segments`
      });
    }

    const owner = routeOwner.get(game.route);
    if (owner) {
      violations.push({
        id: "duplicate-route",
        source: game.slug,
        href: game.route,
        message: `route "${game.route}" is already claimed by "${owner}"; catalog entries must map to distinct routes`
      });
    } else {
      routeOwner.set(game.route, game.slug);
    }

    if (playRoutes.has(game.route)) {
      violations.push({
        id: "conflicting-route",
        source: game.slug,
        href: game.route,
        message: `route "${game.route}" collides with the play route of another catalog entry`
      });
    }

    if (!routeExists(game.route)) {
      violations.push({
        id: "missing-route",
        source: game.slug,
        href: game.route,
        message: `configured route "${game.route}" has no matching site route`
      });
      reportedRegistryRoutes.add(game.route);
    }
  }

  // --- Play routes and unavailable games --------------------------------------
  // Play routes are derived from the catalog route, so a malformed base route was
  // already reported above; re-reporting the derived play route adds no signal.
  for (const game of catalog) {
    if (typeof game.route !== "string" || !INTERNAL_ROUTE_PATTERN.test(game.route)) continue;
    // A missing base route is already reported; the derived play route adds noise.
    if (!routeExists(game.route)) continue;

    const playRoute = getGamePlayRoute(game);
    const playable = game.status === "playable";
    const exists = routeExists(playRoute);

    if (playable && !exists) {
      violations.push({
        id: "missing-play-route",
        source: game.slug,
        href: playRoute,
        message: `playable game declares route "${game.route}" but its play destination "${playRoute}" has no matching site route`
      });
    }

    // A coming-soon game must not keep a private playable page that would render
    // a dead game frame. Sharing a placeholder route instead is fine: point the
    // entry's route at the placeholder (declared in INTENTIONAL_ROUTES) or let
    // the play page render the shared unavailable panel.
    //
    // A preview-gated entry is the sanctioned exception, and it is opt-in rather
    // than inferred: `previewEnabled` is a reviewable source statement. It is safe
    // because the promoted-release helper is status-gated, so a coming-soon entry
    // cannot resolve a production pointer no matter what the page renders, and the
    // candidate only appears when a deployment supplies a preview pointer. The page
    // test asserts the production build renders the shared unavailable panel.
    if (!playable && exists && !game.previewEnabled) {
      violations.push({
        id: "unavailable-game-play-route",
        source: game.slug,
        href: playRoute,
        message: `coming-soon game exposes a playable page at "${playRoute}"; remove the page or point the entry at the shared placeholder route`
      });
    }

    // The reverse drift: `previewEnabled` claims a preview-gated play page exists,
    // so a missing one means reviewable intent no longer matches the tree.
    if (game.previewEnabled && !exists) {
      violations.push({
        id: "missing-preview-play-route",
        source: game.slug,
        href: playRoute,
        message: `coming-soon game declares previewEnabled but "${playRoute}" has no matching site route`
      });
    }
  }

  // --- Known static internal links --------------------------------------------
  const staticLinks: { source: string; href: string }[] = [
    { source: "SiteHeader", href: "/" },
    { source: "SiteHeader", href: "/#collection" },
    { source: "SiteHeader", href: "/#about" },
    { source: "GameLauncher", href: "/#collection" }
  ];

  /** Check one link, tolerating deep asset URLs under Pages Function prefixes. */
  const checkLink = (source: string, href: string): void => {
    if (typeof href !== "string") return;
    // Anchors are page-relative: validate the path portion only.
    if (ANCHOR_PATTERN.test(href)) return;
    const path = href.split("#")[0] ?? href;
    // The registry check already reported this broken route.
    if (reportedRegistryRoutes.has(path)) return;
    if (!isInternalTarget(path)) {
      violations.push({
        id: "missing-route",
        source,
        href,
        message: `static navigation link "${href}" is not an internal site path; use an absolute directory route like "/example/"`
      });
      return;
    }
    if (!routeExists(path)) {
      violations.push({
        id: "missing-route",
        source,
        href,
        message: `static navigation link "${href}" has no matching site route`
      });
    }
  };

  for (const game of catalog) {
    const playRoute = getGamePlayRoute(game);
    // GameCard only renders a link for playable games; GameLauncher's play button
    // is covered by the missing-play-route check above.
    if (game.status === "playable") {
      staticLinks.push({ source: `GameCard:${game.slug}`, href: game.route });
    }
    if (routes.has(game.route)) {
      staticLinks.push({ source: `game-page:${game.slug}`, href: "/" });
    }
    // Toolbar back links and the shared unavailable panel only render on play
    // pages, so only attribute those links when the play page actually exists.
    if (routes.has(playRoute)) {
      staticLinks.push({ source: `play-toolbar:${game.slug}`, href: game.route });
      staticLinks.push({ source: `play-page:${game.slug}`, href: game.route });
      staticLinks.push({ source: `GameUnavailable:${game.slug}`, href: game.route });
    }
  }

  staticLinks.push(...(options.extraStaticLinks ?? []));

  for (const link of staticLinks) {
    checkLink(link.source, link.href);
  }

  return {
    violations,
    routeCount: routes.size,
    functionRoutes,
    notes
  };
}

/** Human-readable one-line rendering used by the CLI and test assertions. */
export function formatViolation(violation: Violation): string {
  return `${violation.source}: ${violation.message}`;
}
