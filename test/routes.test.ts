// Unit tests for the static route/link integrity validator.
// Synthetic page-tree fixtures prove each detection without touching src/pages.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { GameEntry } from "../src/data/games";
import { intentionalRoutes, validateRoutes } from "../src/lib/routes";

function baseEntry(overrides: Partial<GameEntry> = {}): GameEntry {
  return {
    slug: "alpha",
    title: "Alpha",
    status: "playable",
    eyebrow: "",
    description: "Valid description",
    cardImage: "/art/signal-garden-card.svg",
    route: "/alpha/",
    controls: [],
    release: {
      kind: "static-web",
      version: "1.0.0",
      entryFile: "index.html"
    },
    ...overrides
  } as GameEntry;
}

function createPageTree(files: readonly string[]): string {
  const root = mkdtempSync(join(tmpdir(), "games-site-routes-"));
  for (const file of files) {
    const full = join(root, "src", "pages", file);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, "---\n---\n");
  }
  return root;
}

describe("route integrity validation", () => {
  let projectRoot = "";

  beforeEach(() => {
    projectRoot = "";
  });

  afterEach(() => {
    if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
  });

  it("accepts a valid registry with launcher and play pages", () => {
    projectRoot = createPageTree(["index.astro", "alpha/index.astro", "alpha/play.astro"]);

    const result = validateRoutes({
      projectRoot,
      catalog: [baseEntry()]
    });

    expect(result.violations).toEqual([]);
    expect(result.routeCount).toBe(3);
  });

  it("detects a configured route with no matching site route", () => {
    projectRoot = createPageTree(["index.astro", "alpha/index.astro", "alpha/play.astro"]);

    const result = validateRoutes({
      projectRoot,
      catalog: [baseEntry({ slug: "weather-comand", route: "/weather-comand/" })]
    });

    // The actionable root cause is reported once; the derived play route and the
    // collection-card link to the same bad route must not bury it in noise.
    expect(result.violations).toEqual([
      {
        id: "missing-route",
        source: "weather-comand",
        href: "/weather-comand/",
        message: 'configured route "/weather-comand/" has no matching site route'
      }
    ]);
  });

  it("detects a playable game whose play destination has no site route", () => {
    projectRoot = createPageTree(["index.astro", "alpha/index.astro"]);

    const result = validateRoutes({
      projectRoot,
      catalog: [baseEntry()]
    });

    expect(result.violations).toEqual([
      {
        id: "missing-play-route",
        source: "alpha",
        href: "/alpha/play/",
        message:
          'playable game declares route "/alpha/" but its play destination "/alpha/play/" has no matching site route'
      }
    ]);
  });

  it("detects malformed configured routes, including traversal", () => {
    projectRoot = createPageTree(["index.astro"]);

    const result = validateRoutes({
      projectRoot,
      catalog: [
        baseEntry({ slug: "no-slashes", route: "alpha" }),
        baseEntry({ slug: "uppercase", route: "/Alpha/" }),
        baseEntry({ slug: "traversal", route: "/alpha/../secret/" })
      ]
    });

    const malformed = result.violations.filter((violation) => violation.id === "malformed-route");
    expect(malformed.map((violation) => violation.source)).toEqual([
      "no-slashes",
      "uppercase",
      "traversal"
    ]);
    expect(malformed[0]?.message).toContain('"alpha" is malformed');
  });

  it("detects duplicate catalog routes and names the first owner", () => {
    projectRoot = createPageTree(["index.astro", "alpha/index.astro", "alpha/play.astro"]);

    const result = validateRoutes({
      projectRoot,
      catalog: [baseEntry(), baseEntry({ slug: "alpha-clone", route: "/alpha/" })]
    });

    expect(result.violations).toEqual([
      {
        id: "duplicate-route",
        source: "alpha-clone",
        href: "/alpha/",
        message:
          'route "/alpha/" is already claimed by "alpha"; catalog entries must map to distinct routes'
      }
    ]);
  });

  it("detects a catalog route that conflicts with another entry's play route", () => {
    projectRoot = createPageTree(["index.astro", "alpha/index.astro", "alpha/play.astro"]);

    const result = validateRoutes({
      projectRoot,
      catalog: [baseEntry(), baseEntry({ slug: "imposter", route: "/alpha/play/" })]
    });

    expect(result.violations).toContainEqual({
      id: "conflicting-route",
      source: "imposter",
      href: "/alpha/play/",
      message: 'route "/alpha/play/" collides with the play route of another catalog entry'
    });
  });

  it("flags a coming-soon game that still exposes its own playable page", () => {
    projectRoot = createPageTree([
      "index.astro",
      "beta/index.astro",
      "beta/play.astro",
      "alpha/index.astro",
      "alpha/play.astro"
    ]);

    const result = validateRoutes({
      projectRoot,
      catalog: [
        baseEntry(),
        baseEntry({
          slug: "beta",
          status: "coming-soon",
          release: undefined,
          route: "/beta/"
        })
      ]
    });

    expect(result.violations).toContainEqual({
      id: "unavailable-game-play-route",
      source: "beta",
      href: "/beta/play/",
      message:
        'coming-soon game exposes a playable page at "/beta/play/"; remove the page or point the entry at the shared placeholder route'
    });
  });

  it("accepts a coming-soon game with no pages as an intentional non-page route", () => {
    projectRoot = createPageTree(["index.astro", "alpha/index.astro", "alpha/play.astro"]);

    const result = validateRoutes({
      projectRoot,
      catalog: [
        baseEntry(),
        baseEntry({
          slug: "new-world-01",
          status: "coming-soon",
          release: undefined,
          route: "/new-world-01/"
        })
      ]
    });

    expect(result.violations).toEqual([]);
    expect(intentionalRoutes.map((entry) => entry.route)).toContain("/new-world-01/");
  });

  it("validates static navigation links against the discovered routes", () => {
    projectRoot = createPageTree(["index.astro", "alpha/index.astro", "alpha/play.astro"]);

    const result = validateRoutes({
      projectRoot,
      catalog: [baseEntry()],
      extraStaticLinks: [
        { source: "TestFooter", href: "/#collection" },
        { source: "TestFooter", href: "/missing/" },
        { source: "TestFooter", href: "not-a-route" },
        { source: "TestFooter", href: "#in-page" }
      ]
    });

    expect(result.violations).toEqual([
      {
        id: "missing-route",
        source: "TestFooter",
        href: "/missing/",
        message: 'static navigation link "/missing/" has no matching site route'
      },
      {
        id: "missing-route",
        source: "TestFooter",
        href: "not-a-route",
        message:
          'static navigation link "not-a-route" is not an internal site path; use an absolute directory route like "/example/"'
      }
    ]);
  });

  it("treats Pages Function prefixes from _routes.json as resolvable targets", () => {
    projectRoot = createPageTree(["index.astro", "alpha/index.astro", "alpha/play.astro"]);
    mkdirSync(join(projectRoot, "public"), { recursive: true });
    writeFileSync(
      join(projectRoot, "public", "_routes.json"),
      JSON.stringify({ version: 1, include: ["/game-assets/*"], exclude: [] })
    );

    const result = validateRoutes({
      projectRoot,
      catalog: [baseEntry()],
      extraStaticLinks: [{ source: "TestFrame", href: "/game-assets/alpha/1.0.0/index.html" }]
    });

    expect(result.violations).toEqual([]);
    expect(result.functionRoutes).toEqual(["/game-assets/"]);
  });

  it("honours _routes.json excludes and notes an unparsable manifest", () => {
    projectRoot = createPageTree(["index.astro"]);
    mkdirSync(join(projectRoot, "public"), { recursive: true });
    writeFileSync(
      join(projectRoot, "public", "_routes.json"),
      JSON.stringify({ version: 1, include: ["/api/*"], exclude: ["/api/private/*"] })
    );

    const excluded = validateRoutes({
      projectRoot,
      catalog: [],
      extraStaticLinks: [{ source: "Test", href: "/api/private/x/" }]
    });
    expect(excluded.violations.map((violation) => violation.id)).toContain("missing-route");

    writeFileSync(join(projectRoot, "public", "_routes.json"), "{not json");
    const unparsable = validateRoutes({ projectRoot, catalog: [] });
    expect(unparsable.notes.join("\n")).toContain("_routes.json");
  });
});
