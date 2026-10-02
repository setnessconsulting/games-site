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
  const publicRelative = relative(publicRoot, file);
  if (
    publicRelative === "" ||
    publicRelative === ".." ||
    publicRelative.startsWith(`..${sep}`) ||
    isAbsolute(publicRelative)
  ) {
    return undefined;
  }

  return {
    file
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
