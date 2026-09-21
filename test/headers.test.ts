import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { games } from "../src/data/games";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const headersPath = join(root, "public", "_headers");

function readHeaders(): string {
  return readFileSync(headersPath, "utf8");
}

function hasClickjackingDefenses(headersSource: string): boolean {
  return (
    /X-Frame-Options:\s*DENY/i.test(headersSource) && /frame-ancestors\s+'none'/.test(headersSource)
  );
}

describe("public/_headers security contract", () => {
  it("includes clickjacking defenses", () => {
    const headers = readHeaders();
    expect(headers).toContain("X-Frame-Options: DENY");
    expect(headers).toContain("frame-ancestors 'none'");
  });

  it("blocks promoting games to playable unless clickjacking defenses are present", () => {
    const headers = readHeaders();
    const playable = games.filter((game) => game.status === "playable");

    // Live headers must carry both defenses before any playable entry is allowed.
    expect(hasClickjackingDefenses(headers)).toBe(true);
    if (playable.length > 0) {
      expect(headers).toContain("X-Frame-Options: DENY");
      expect(headers).toContain("frame-ancestors 'none'");
    }

    // Flipping a game to playable would be blocked if those lines were removed.
    const stripped = headers
      .replace(/^\s*X-Frame-Options:.*$/gim, "")
      .replace(/frame-ancestors\s+'none';?\s*/g, "");
    expect(hasClickjackingDefenses(stripped)).toBe(false);
    expect(playable.length === 0 || hasClickjackingDefenses(headers)).toBe(true);
  });

  it("keeps the game-assets cache rule", () => {
    const headers = readHeaders();
    expect(headers).toContain("/game-assets/*");
    expect(headers).toContain("Cache-Control: public, max-age=31536000, immutable");
  });
});
