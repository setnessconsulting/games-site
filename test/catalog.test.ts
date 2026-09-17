import { describe, expect, it } from "vitest";
import { games } from "../src/data/games";
import { validateCatalog } from "../src/lib/catalog";

describe("game catalog", () => {
  it("contains a valid, unique catalog", () => {
    expect(validateCatalog(games)).toEqual([]);
    expect(new Set(games.map((game) => game.slug)).size).toBe(games.length);
  });

  it("keeps future games non-playable", () => {
    expect(games.filter((game) => game.status === "coming-soon")).toHaveLength(4);
    expect(games.every((game) => game.status === "coming-soon" && !game.release)).toBe(true);
    expect(games.find((game) => game.slug === "bridge-builder")?.route).toBe("/bridge-builder/");
  });

  it("accepts the static release shape without making it playable", () => {
    const candidate = {
      ...games.find((game) => game.slug === "bridge-builder")!,
      status: "playable" as const,
      release: {
        kind: "static" as const,
        version: "0.1.0",
        entryFile: "index.html",
        manifestFile: "release-manifest.json"
      }
    };
    expect(validateCatalog([candidate])).toEqual([]);
  });
});
