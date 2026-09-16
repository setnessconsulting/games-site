import { describe, expect, it } from "vitest";
import { games } from "../src/data/games";
import { validateCatalog } from "../src/lib/catalog";

describe("game catalog", () => {
  it("contains a valid, unique catalog", () => {
    expect(validateCatalog(games)).toEqual([]);
    expect(new Set(games.map((game) => game.slug)).size).toBe(games.length);
  });

  it("keeps future games non-playable", () => {
    expect(games.filter((game) => game.status === "coming-soon")).toHaveLength(3);
    expect(games.every((game) => game.status === "coming-soon" && !game.release)).toBe(true);
  });
});
