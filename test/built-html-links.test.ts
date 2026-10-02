import { afterEach, describe, expect, it } from "vitest";

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { validateBuiltLinks } from "../src/lib/built-html-links";

const temporaryRoots: string[] = [];

function createProject(withDist = true): string {
  const root = mkdtempSync(join(tmpdir(), "games-site-built-links-"));
  temporaryRoots.push(root);
  mkdirSync(join(root, "src", "pages"), { recursive: true });
  writeFileSync(join(root, "src", "pages", "index.astro"), "---\n---\n");
  mkdirSync(join(root, "public"), { recursive: true });
  writeFileSync(
    join(root, "public", "_routes.json"),
    JSON.stringify({ version: 1, include: ["/game-assets/*"], exclude: [] })
  );
  if (withDist) mkdirSync(join(root, "dist"), { recursive: true });
  return root;
}

function writeDistFile(projectRoot: string, path: string, content: string): void {
  const file = join(projectRoot, "dist", path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("built HTML link validation", () => {
  it("accepts routes, built assets, function paths, fragments, and external links", () => {
    const projectRoot = createProject();
    mkdirSync(join(projectRoot, "public", "media"), { recursive: true });
    writeFileSync(join(projectRoot, "public", "media", "card.svg"), "<svg />");
    writeDistFile(projectRoot, "media/card.svg", "<svg />");
    writeDistFile(
      projectRoot,
      "index.html",
      `<!doctype html>
<a href="/">Home</a>
<a href="#details">Details</a>
<a href="mailto:hello@example.test">Email</a>
<a href="/media/card.svg">Card</a>
<img src="/media/card.svg" alt="" />
<iframe src="/game-assets/fraction-match/1.0.0/index.html"></iframe>
<script>const note = 'href="/script-only-missing/"';</script>
<!-- <a href="/comment-only-missing/">Comment</a> -->`
    );

    const result = validateBuiltLinks({ projectRoot });

    expect(result.violations).toEqual([]);
    expect(result.htmlFiles).toBe(1);
    expect(result.checkedReferences).toBe(4);
  });

  it("reports missing internal href and src values against the dist file", () => {
    const projectRoot = createProject();
    writeDistFile(
      projectRoot,
      "index.html",
      '<a href="/missing/">Missing page</a><img src="/art/missing.svg" alt="" />'
    );

    const result = validateBuiltLinks({ projectRoot });

    expect(result.violations).toEqual([
      {
        source: "dist/index.html",
        reference: "/missing/",
        message: 'dist/index.html: link "/missing/" has no matching site route or built asset'
      },
      {
        source: "dist/index.html",
        reference: "/art/missing.svg",
        message:
          'dist/index.html: source "/art/missing.svg" has no matching site route or built asset'
      }
    ]);
  });

  it("fails clearly when dist/ has not been built", () => {
    const projectRoot = createProject(false);

    const result = validateBuiltLinks({ projectRoot });

    expect(result.htmlFiles).toBe(0);
    expect(result.violations[0]?.message).toContain("run npm run build");
  });
});
