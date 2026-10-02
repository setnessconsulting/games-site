import { readdirSync, readFileSync, statSync, type Dirent } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { createRouteResolver } from "./routes";

const SOURCE_EXTENSIONS = new Set([
  ".astro",
  ".css",
  ".html",
  ".js",
  ".jsx",
  ".less",
  ".mjs",
  ".sass",
  ".scss",
  ".ts",
  ".tsx"
]);

const ATTRIBUTE_PATTERN = /\b(href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const CSS_URL_PATTERN = /url\(\s*(?:(['"])(.*?)\1|([^)'"\s]+))\s*\)/gi;

interface AssetReference {
  readonly kind: "href" | "src" | "css url";
  readonly value: string;
  readonly offset: number;
}

export interface StaticAssetViolation {
  readonly source: string;
  readonly line: number;
  readonly reference: string;
  readonly message: string;
}

export interface StaticAssetOptions {
  /** Project root containing src/ and public/. Defaults to process.cwd(). */
  readonly projectRoot?: string;
}

export interface StaticAssetValidationResult {
  readonly violations: readonly StaticAssetViolation[];
  readonly checkedReferences: number;
}

function walkSourceFiles(dir: string, out: string[]): void {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSourceFiles(full, out);
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
}

function collectReferences(source: string): AssetReference[] {
  const references: AssetReference[] = [];
  let match: RegExpExecArray | null;

  ATTRIBUTE_PATTERN.lastIndex = 0;
  while ((match = ATTRIBUTE_PATTERN.exec(source))) {
    references.push({
      kind: match[1]?.toLowerCase() === "href" ? "href" : "src",
      value: match[2] ?? match[3] ?? match[4] ?? "",
      offset: match.index
    });
  }

  CSS_URL_PATTERN.lastIndex = 0;
  while ((match = CSS_URL_PATTERN.exec(source))) {
    references.push({
      kind: "css url",
      value: match[2] ?? match[3] ?? "",
      offset: match.index
    });
  }

  return references;
}

function toPosix(value: string): string {
  return value.split(sep).join("/");
}

function decodeReference(value: string): string {
  return value
    .trim()
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function isExternalOrFragment(value: string): boolean {
  return (
    value.length === 0 ||
    value.startsWith("#") ||
    /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value) ||
    value.startsWith("{")
  );
}

function publicFileForReference(
  publicRoot: string,
  sourceFile: string,
  value: string
): { file: string } | undefined {
  const pathname = value.split(/[?#]/, 1)[0] ?? "";
  // `/game-assets/...` is served by the Pages Function from R2, not from this
  // repository, so there is no in-repo file to check.
  if (!pathname || pathname.includes("\\") || pathname.startsWith("/game-assets/"))
    return undefined;

  let decodedPath = pathname;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    // Preserve malformed escapes so the missing-file diagnostic remains useful.
  }

  const file = decodedPath.startsWith("/")
    ? resolve(publicRoot, `.${decodedPath}`)
    : resolve(dirname(sourceFile), decodedPath);

  // A relative reference resolves against its own source directory, which is
  // normally `src/` rather than `public/`. Those assets ship only if a copy also
  // exists under public/, so the reference is checked against public/ as a whole:
  // an absolute-looking `/x` maps to `public/x`, and a relative one is verified by
  // its path relative to `public/` once the `src/` prefix is dropped.
  const publicRelative = decodedPath.startsWith("/")
    ? decodedPath.slice(1)
    : toPosix(relative(publicRoot, file));
  if (
    publicRelative === "" ||
    publicRelative === ".." ||
    publicRelative.startsWith("../") ||
    isAbsolute(publicRelative)
  ) {
    // The reference points outside public/, so it is not a repo-resident asset
    // this check owns (for example a `src/`-local import). Skip it rather than
    // report a false positive.
    return undefined;
  }

  return {
    file: resolve(publicRoot, publicRelative)
  };
}

function isFile(file: string): boolean {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

/** Check literal public/ asset references found in source templates and styles. */
export function validateStaticAssets(
  options: StaticAssetOptions = {}
): StaticAssetValidationResult {
  const projectRoot = resolve(options.projectRoot ?? process.cwd());
  const sourceRoot = join(projectRoot, "src");
  // Always resolve public/ from the caller's projectRoot: fixture projects pass
  // their own synthetic root, and falling back to this module's public/ would
  // silently validate fixtures against the real repository's assets.
  const publicRoot = join(projectRoot, "public");
  const routeResolver = createRouteResolver({ projectRoot });
  const files: string[] = [];
  walkSourceFiles(sourceRoot, files);

  const violations: StaticAssetViolation[] = [];
  let checkedReferences = 0;

  for (const sourceFile of files) {
    const source = readFileSync(sourceFile, "utf8");
    for (const reference of collectReferences(source)) {
      const value = decodeReference(reference.value);
      if (isExternalOrFragment(value)) continue;

      const pathname = value.split(/[?#]/, 1)[0] ?? "";
      if (!pathname || routeResolver.routeExists(pathname)) continue;

      const target = publicFileForReference(publicRoot, sourceFile, value);
      if (!target) continue;
      if (reference.kind === "href" && !extname(pathname) && !isFile(target.file)) continue;

      checkedReferences += 1;
      if (isFile(target.file)) continue;

      const relativeSource = relative(projectRoot, sourceFile).split(sep).join("/");
      const line = source.slice(0, reference.offset).split("\n").length;
      violations.push({
        source: relativeSource,
        line,
        reference: value,
        message: `${relativeSource}:${line}: ${reference.kind} asset "${value}" does not exist under public/`
      });
    }
  }

  return { violations, checkedReferences };
}
