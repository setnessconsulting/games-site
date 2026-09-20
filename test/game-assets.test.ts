import { describe, expect, it } from "vitest";
import { BRIDGE_BUILDER_PRODUCTION_VERSION } from "../src/data/games";
import {
  buildAssetKey,
  fallbackContentType,
  isApprovedRelease,
  parseAssetPath,
  parseByteRange
} from "../src/lib/game-assets";

describe("game asset contract", () => {
  it("parses a safe nested asset path", () => {
    const parsed = parseAssetPath(["test-fixture", "0.0.0", "Build", "test-fixture.loader.js"]);
    expect(parsed).toEqual({
      slug: "test-fixture",
      version: "0.0.0",
      assetPath: "Build/test-fixture.loader.js"
    });
    expect(buildAssetKey(parsed!)).toBe("test-fixture/0.0.0/Build/test-fixture.loader.js");
  });

  it("rejects traversal and incomplete requests", () => {
    expect(parseAssetPath(["test-fixture", "0.0.0", "..", "secrets.txt"])).toBeUndefined();
    expect(parseAssetPath(["test-fixture", "0.0.0"])).toBeUndefined();
    expect(parseAssetPath(["bad slug", "0.0.0", "Build", "file.js"])).toBeUndefined();
  });

  it("only approves the fixture when explicitly enabled", () => {
    expect(isApprovedRelease("test-fixture", "0.0.0", false)).toBe(false);
    expect(isApprovedRelease("test-fixture", "0.0.0", true)).toBe(true);
    expect(isApprovedRelease("signal-garden", "0.0.1", true)).toBe(false);
    expect(isApprovedRelease("bridge-builder", "0.1.0", false)).toBe(false);
    expect(isApprovedRelease("bridge-builder", BRIDGE_BUILDER_PRODUCTION_VERSION, false)).toBe(
      true
    );
    expect(isApprovedRelease("bridge-builder", "0.1.0", false, "0.1.0")).toBe(true);
  });

  it("approves only the exact Number Line Jumper preview slug and version", () => {
    const previewVersion = "pr8-c7428853083f";

    expect(
      isApprovedRelease("number-line-jumper", previewVersion, false, undefined, previewVersion)
    ).toBe(true);
    expect(
      isApprovedRelease("number-line-jumper", "other-version", false, undefined, previewVersion)
    ).toBe(false);
    expect(
      isApprovedRelease("bridge-builder", previewVersion, false, undefined, previewVersion)
    ).toBe(false);
  });

  it("provides safe content type fallbacks", () => {
    expect(fallbackContentType("Build/game.wasm")).toBe("application/wasm");
    expect(fallbackContentType("Build/game.loader.js")).toContain("text/javascript");
    expect(fallbackContentType("Build/game.data")).toBe("application/octet-stream");
  });

  it("normalizes byte ranges for R2 responses", () => {
    expect(parseByteRange("bytes=0-4", 40)).toEqual({ start: 0, end: 4, length: 5 });
    expect(parseByteRange("bytes=5-", 40)).toEqual({ start: 5, end: 39, length: 35 });
    expect(parseByteRange("bytes=-5", 40)).toEqual({ start: 35, end: 39, length: 5 });
    expect(parseByteRange("bytes=40-", 40)).toBeUndefined();
    expect(parseByteRange("bytes=4-2", 40)).toBeUndefined();
  });
});
