import { afterEach, describe, expect, it } from "vitest";

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateStaticAssets } from "../src/lib/static-assets";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoots: string[] = [];

function createProject(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "games-site-static-assets-"));
  temporaryRoots.push(root);

  for (const [path, content] of Object.entries(files)) {
    const file = join(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }

  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("static public asset validation", () => {
  it("accepts the repository's current literal public asset references", () => {
    const result = validateStaticAssets({ projectRoot: repositoryRoot });

    expect(result.violations).toEqual([]);
    expect(result.checkedReferences).toBeGreaterThan(0);
  });

  it("reports a missing template asset with its source and line", () => {
    const projectRoot = createProject({
      "src/pages/index.astro": '<img src="/art/missing.svg" alt="Missing" />\n'
    });

    const result = validateStaticAssets({ projectRoot });

    expect(result.violations).toEqual([
      {
        source: "src/pages/index.astro",
        line: 1,
        reference: "/art/missing.svg",
        message:
          'src/pages/index.astro:1: src asset "/art/missing.svg" does not exist under public/'
      }
    ]);
  });

  it("checks CSS url() assets and ignores R2 Function paths", () => {
    const projectRoot = createProject({
      "public/_routes.json": JSON.stringify({
        version: 1,
        include: ["/game-assets/*"],
        exclude: []
      }),
      "public/art/pond.svg": "<svg />",
      "src/pages/index.astro":
        '<style>.pond { background-image: url("/art/pond.svg"); }</style>\n' +
        '<iframe src="/game-assets/ecosystem-rescue/1.0.0/index.html"></iframe>\n'
    });

    const result = validateStaticAssets({ projectRoot });

    expect(result.violations).toEqual([]);
    expect(result.checkedReferences).toBe(1);
  });
});
