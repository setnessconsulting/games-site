// Regression tests for catalog validation edge cases
import { expect, it, describe } from "vitest";
import { validateCatalog } from "../src/lib/catalog";
import type { GameEntry } from "../src/data/games";

// Helper to create a minimal valid entry
function baseEntry(overrides: Partial<GameEntry> = {}): GameEntry {
  return {
    slug: "valid-slug",
    title: "Valid Title",
    status: "playable",
    eyebrow: "",
    description: "Valid description",
    cardImage: "/art/signal-garden-card.svg",
    route: "/valid-slug/",
    controls: [],
    release: {
      kind: "static-web",
      version: "1.0.0",
      entryFile: "index.html"
    },
    ...overrides
  } as GameEntry;
}

describe("catalog validation regression fixtures", () => {
  it("detects duplicate slugs", () => {
    const a = baseEntry({ slug: "dup" });
    const b = baseEntry({ slug: "dup" });
    const errors = validateCatalog([a, b]);
    expect(errors).toContain("dup: duplicate slug");
  });

  it("detects duplicate routes", () => {
    const a = baseEntry({ slug: "a", route: "/same/" });
    const b = baseEntry({ slug: "b", route: "/same/" });
    const errors = validateCatalog([a, b]);
    expect(errors).toContain("b: duplicate route /same/");
  });

  it("detects missing title", () => {
    const a = baseEntry({ title: "" });
    const errors = validateCatalog([a]);
    expect(errors).toContain(`${a.slug}: missing or empty title`);
  });

  it("detects missing card asset", () => {
    const a = baseEntry({ cardImage: "/art/nonexistent.svg" });
    const errors = validateCatalog([a]);
    expect(errors).toContain(`${a.slug}: cardImage asset not found at /art/nonexistent.svg`);
  });
});
