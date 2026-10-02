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

  it("reports a referenced favicon-style layout asset with its source and line", () => {
    const projectRoot = createProject({
      "src/layouts/BaseLayout.astro":
        "<html>\n" +
        '  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />\n' +
        "</html>\n"
    });

    const result = validateStaticAssets({ projectRoot });

    expect(result.violations).toEqual([
      {
        source: "src/layouts/BaseLayout.astro",
        line: 2,
        reference: "/favicon.svg",
        message:
          'src/layouts/BaseLayout.astro:2: href asset "/favicon.svg" does not exist under public/'
      }
    ]);
  });

  it("reports a root-relative CSS url() that has no public/ counterpart", () => {
    const projectRoot = createProject({
      "public/art/present.svg": "<svg />",
      "src/styles/global.css":
        ".present { background: url('/art/present.svg'); }\n" +
        ".absent { background: url('/art/absent.svg'); }\n"
    });

    const result = validateStaticAssets({ projectRoot });

    expect(result.violations).toEqual([
      {
        source: "src/styles/global.css",
        line: 2,
        reference: "/art/absent.svg",
        message:
          'src/styles/global.css:2: css url asset "/art/absent.svg" does not exist under public/'
      }
    ]);
    expect(result.checkedReferences).toBe(2);
  });

  it("ignores references that resolve outside public/ rather than reporting false positives", () => {
    const projectRoot = createProject({
      "public/_routes.json": JSON.stringify({
        version: 1,
        include: ["/game-assets/*"],
        exclude: []
      }),
      "src/pages/index.astro":
        "<style>.local { background: url('../local/only-in-src.svg'); }</style>\n" +
        '<a href="https://example.com/remote.png">remote</a>\n' +
        '<a href="mailto:hello@example.test">mail</a>\n' +
        '<a href="tel:+15550100">tel</a>\n' +
        '<a href="#section">fragment</a>\n' +
        '<iframe src="/game-assets/fraction-match/1.0.0/index.html"></iframe>\n'
    });

    const result = validateStaticAssets({ projectRoot });

    expect(result.violations).toEqual([]);
    expect(result.checkedReferences).toBe(0);
  });
});
