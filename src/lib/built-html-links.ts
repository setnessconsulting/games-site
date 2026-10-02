import { existsSync, readdirSync, readFileSync, statSync, type Dirent } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { createRouteResolver } from "./routes";

const TAG_PATTERN = /<[a-z][a-z\d:-]*\b[^<>]*>/gi;
const ATTRIBUTE_PATTERN = /\b(href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const COMMENT_PATTERN = /<!--[\s\S]*?-->/g;
const RAW_TEXT_PATTERN = /(<(script|style)\b[^>]*>)[\s\S]*?<\/\2\s*>/gi;
const EXTERNAL_URL_PATTERN = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;
const URL_BASE = "https://games-site.invalid";

interface HtmlReference {
  readonly attribute: "href" | "src";
  readonly value: string;
}

export interface BuiltLinkViolation {
  readonly source: string;
  readonly reference: string;
  readonly message: string;
}

export interface BuiltLinksOptions {
  /** Project root containing src/ and public/. Defaults to process.cwd(). */
  readonly projectRoot?: string;
  /** Build output directory, relative to projectRoot unless absolute. Defaults to dist/. */
  readonly distDir?: string;
}

export interface BuiltLinksValidationResult {
  readonly violations: readonly BuiltLinkViolation[];
  readonly htmlFiles: number;
  readonly checkedReferences: number;
}

function walkHtmlFiles(dir: string, out: string[]): void {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkHtmlFiles(full, out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
      out.push(full);
    }
  }
}

function collectReferences(html: string): HtmlReference[] {
  const references: HtmlReference[] = [];
  const markup = html.replace(COMMENT_PATTERN, "").replace(RAW_TEXT_PATTERN, "$1");
  TAG_PATTERN.lastIndex = 0;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = TAG_PATTERN.exec(markup))) {
    ATTRIBUTE_PATTERN.lastIndex = 0;
    let attributeMatch: RegExpExecArray | null;
    while ((attributeMatch = ATTRIBUTE_PATTERN.exec(tagMatch[0]))) {
      references.push({
        attribute: attributeMatch[1]?.toLowerCase() === "href" ? "href" : "src",
        value: attributeMatch[2] ?? attributeMatch[3] ?? attributeMatch[4] ?? ""
      });
    }
  }
  return references;
}

function decodeHtmlEntities(value: string): string {
  return value
    .trim()
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function routeForHtmlFile(distRoot: string, htmlFile: string): string {
  const directory = relative(distRoot, dirname(htmlFile)).split(sep).join("/");
  return directory === "" ? "/" : `/${directory}/`;
}

function resolveInternalPath(value: string, pageRoute: string): string | undefined {
  const reference = decodeHtmlEntities(value);
  if (!reference || reference.startsWith("#") || EXTERNAL_URL_PATTERN.test(reference))
    return undefined;

  try {
    return new URL(reference, `${URL_BASE}${pageRoute}`).pathname;
  } catch {
    return undefined;
  }
}

function isBuiltFile(distRoot: string, pathname: string): boolean {
  let decodedPath = pathname;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    // Keep malformed escapes in the path so they do not silently match another file.
  }

  const candidate = resolve(distRoot, `.${decodedPath}`);
  const relativePath = relative(distRoot, candidate);
  if (relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    return false;
  }

  const candidates = pathname.endsWith("/") ? [join(candidate, "index.html")] : [candidate];
  return candidates.some((file) => {
    try {
      return statSync(file).isFile();
    } catch {
      return false;
    }
  });
}

/** Validate internal href/src references in generated HTML against the route model and dist/. */
export function validateBuiltLinks(options: BuiltLinksOptions = {}): BuiltLinksValidationResult {
  const projectRoot = resolve(options.projectRoot ?? process.cwd());
  const configuredDistDir = options.distDir ?? "dist";
  const distRoot = isAbsolute(configuredDistDir)
    ? configuredDistDir
    : resolve(projectRoot, configuredDistDir);
  const relativeDist = relative(projectRoot, distRoot).split(sep).join("/");

  if (!existsSync(distRoot) || !statSync(distRoot).isDirectory()) {
    return {
      violations: [
        {
          source: relativeDist || "dist",
          reference: "",
          message: `${relativeDist || "dist"}: build output directory is missing; run npm run build before npm run validate:built-links`
        }
      ],
      htmlFiles: 0,
      checkedReferences: 0
    };
  }

  const resolver = createRouteResolver({ projectRoot });
  const htmlFiles: string[] = [];
  walkHtmlFiles(distRoot, htmlFiles);
  const violations: BuiltLinkViolation[] = [];
  let checkedReferences = 0;

  for (const htmlFile of htmlFiles) {
    const html = readFileSync(htmlFile, "utf8");
    const source = `dist/${relative(distRoot, htmlFile).split(sep).join("/")}`;
    const pageRoute = routeForHtmlFile(distRoot, htmlFile);

    for (const reference of collectReferences(html)) {
      const pathname = resolveInternalPath(reference.value, pageRoute);
      if (!pathname) continue;

      checkedReferences += 1;
      if (resolver.routeExists(pathname) || isBuiltFile(distRoot, pathname)) continue;

      const kind = reference.attribute === "href" ? "link" : "source";
      violations.push({
        source,
        reference: pathname,
        message: `${source}: ${kind} "${pathname}" has no matching site route or built asset`
      });
    }
  }

  return { violations, htmlFiles: htmlFiles.length, checkedReferences };
}
