// Integration coverage: the real catalog and page tree must satisfy the
// route/link integrity contract on every test run.
import { describe, expect, it } from "vitest";

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { games } from "../src/data/games";
import { validateRoutes } from "../src/lib/routes";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("repository route integrity", () => {
  it("finds no violations for the committed catalog and page tree", () => {
    const result = validateRoutes({ projectRoot });

    expect(result.violations).toEqual([]);
    expect(result.routeCount).toBeGreaterThanOrEqual(13);
    expect(result.functionRoutes).toContain("/game-assets/");
  });

  it("derives a launcher and play route for every playable catalog game", () => {
    const result = validateRoutes({ projectRoot, catalog: games });
    const expectedRoutes = games
      .filter((game) => game.status === "playable")
      .map((game) => game.route);

    for (const route of expectedRoutes) {
      expect(result.violations.filter((violation) => violation.href === route)).toEqual([]);
    }
  });
});
