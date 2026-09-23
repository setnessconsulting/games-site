import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { games, type GameEntry } from "../src/data/games";
import { validateCatalog } from "../src/lib/catalog";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const headersPath = join(root, "public", "_headers");

function readHeaders(): string {
  return readFileSync(headersPath, "utf8");
}

const HEADERS_SOURCE = readHeaders();

interface HeaderEntry {
  name: string;
  /** `null` represents Cloudflare's `! Name` detach directive. */
  value: string | null;
}

interface HeaderRule {
  pattern: string;
  entries: HeaderEntry[];
}

const HEADER_NAME = "[A-Za-z0-9!#$%&'*+.^_`|~-]+";
const HEADER_LINE = new RegExp(`^(${HEADER_NAME})\\s*:\\s*(\\S.*)$`);
const DETACH_LINE = new RegExp(`^!\\s*(${HEADER_NAME})$`);

/**
 * Parses a Cloudflare Pages `_headers` file. A non-indented line opens a rule,
 * indented lines populate it, and `! Name` detaches a header. Cloudflare
 * silently discards a rule it cannot parse, so unparseable lines are returned
 * rather than ignored.
 */
function parseHeaders(source: string): { rules: HeaderRule[]; malformed: string[] } {
  const rules: HeaderRule[] = [];
  const malformed: string[] = [];
  let current: HeaderRule | undefined;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;

    if (!/^\s/.test(rawLine)) {
      current = { pattern: line, entries: [] };
      rules.push(current);
      continue;
    }

    if (!current) {
      malformed.push(rawLine);
      continue;
    }

    const detach = DETACH_LINE.exec(line);
    if (detach) {
      current.entries.push({ name: detach[1], value: null });
      continue;
    }

    const header = HEADER_LINE.exec(line);
    if (!header) {
      malformed.push(rawLine);
      continue;
    }
    current.entries.push({ name: header[1], value: header[2].trim() });
  }

  return { rules, malformed };
}

const PLACEHOLDER = /:[A-Za-z]\w*/g;

/** Matches a request path against a `_headers` pattern (`*` splats and `:name` placeholders). */
function matchesPath(pattern: string, requestPath: string): boolean {
  if (pattern.includes("://")) return false;
  const source = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\*/g, ".*")
    .replace(PLACEHOLDER, "[^/]+");
  return new RegExp(`^${source}$`).test(requestPath);
}

/**
 * Resolves the headers Cloudflare applies to a path. A request matching several
 * rules inherits every matching rule's headers, and repeated header names are
 * joined with a comma.
 */
function effectiveHeaders(rules: HeaderRule[], requestPath: string): Map<string, string> {
  const effective = new Map<string, string>();
  for (const rule of rules) {
    if (!matchesPath(rule.pattern, requestPath)) continue;
    for (const entry of rule.entries) {
      const name = entry.name.toLowerCase();
      if (entry.value === null) {
        effective.delete(name);
        continue;
      }
      const existing = effective.get(name);
      effective.set(name, existing ? `${existing}, ${entry.value}` : entry.value);
    }
  }
  return effective;
}

function parseCsp(value: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const chunk of value.split(";")) {
    const [name, ...sources] = chunk.trim().split(/\s+/).filter(Boolean);
    if (name) directives.set(name.toLowerCase(), sources);
  }
  return directives;
}

const CSP_FALLBACK_CHAINS: Record<string, string[]> = {
  "frame-src": ["child-src", "default-src"],
  "worker-src": ["child-src", "script-src", "default-src"]
};

/** Resolves effective CSP sources, applying the fallback chain for frames and workers. */
function cspSources(csp: Map<string, string[]>, directive: string): string[] {
  const candidates = [directive, ...(CSP_FALLBACK_CHAINS[directive] ?? ["default-src"])];
  for (const candidate of candidates) {
    const sources = csp.get(candidate);
    if (sources) return sources;
  }
  return [];
}

/**
 * CSP sources the games shell needs at runtime, each confirmed against the
 * shipped artifacts rather than assumed:
 * - `'wasm-unsafe-eval'`: `WebGL.loader.js` calls `WebAssembly.compile`, and the
 *   framework calls `WebAssembly.instantiateStreaming`.
 * - `'unsafe-inline'` (script): the play pages ship inline bootstrap scripts.
 * - `'unsafe-inline'` (style): the Unity loader sets element style attributes
 *   and injects a `<style>` element.
 * - `'self'` (connect-src): the data/wasm/framework payloads are same-origin.
 * - `blob:` (worker-src): the Unity framework creates object URLs for its
 *   worker and audio.
 */
const REQUIRED_CSP_SOURCES: { directive: string; sources: string[] }[] = [
  { directive: "script-src", sources: ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'"] },
  { directive: "style-src", sources: ["'self'", "'unsafe-inline'"] },
  { directive: "connect-src", sources: ["'self'"] },
  { directive: "worker-src", sources: ["'self'", "blob:"] }
];

const WIDENING_DIRECTIVES = [
  "default-src",
  "script-src",
  "style-src",
  "connect-src",
  "frame-src",
  "worker-src",
  "img-src",
  "font-src"
];

const WILDCARD_SOURCES = new Set(["*", "http:", "https:", "ws:", "wss:"]);

/**
 * The promotion gate: returns every reason the current header policy must not
 * admit a playable catalog entry. An empty result means the defenses hold.
 * It deliberately evaluates the policy Cloudflare would actually serve, so a
 * read-only check cannot be satisfied by a string that no route ever receives.
 */
function evaluatePromotionGate(source: string): string[] {
  const violations: string[] = [];
  const { rules, malformed } = parseHeaders(source);

  violations.push(
    ...malformed.map((line) => `_headers has an unparseable line: ${JSON.stringify(line.trim())}`)
  );
  if (rules.length === 0) violations.push("_headers declares no rules");
  if (!rules.some((rule) => rule.pattern === "/*")) {
    violations.push("_headers must declare a site-wide /* rule");
  }

  // No rule may relax or detach the clickjacking and runtime policy.
  for (const rule of rules) {
    for (const entry of rule.entries) {
      const name = entry.name.toLowerCase();
      if (name !== "x-frame-options" && name !== "content-security-policy") continue;

      if (entry.value === null) {
        violations.push(`${rule.pattern}: ! ${entry.name} detaches a required policy`);
        continue;
      }
      if (name === "x-frame-options" && entry.value.toUpperCase() !== "DENY") {
        violations.push(`${rule.pattern}: X-Frame-Options must stay DENY, found ${entry.value}`);
      }
      if (/frame-ancestors/i.test(entry.value) && !/frame-ancestors\s+'none'/.test(entry.value)) {
        violations.push(`${rule.pattern}: frame-ancestors must stay 'none'`);
      }
    }
  }

  const siteHeaders = effectiveHeaders(rules, "/");
  const xfo = siteHeaders.get("x-frame-options");
  if (xfo?.toUpperCase() !== "DENY") {
    violations.push(`site-wide X-Frame-Options must be DENY, found ${xfo ?? "nothing"}`);
  }

  const policy = siteHeaders.get("content-security-policy");
  if (!policy) {
    violations.push("site-wide Content-Security-Policy is missing");
    return violations;
  }

  const csp = parseCsp(policy);
  const ancestors = csp.get("frame-ancestors");
  if (ancestors?.length !== 1 || ancestors[0] !== "'none'") {
    violations.push(
      `frame-ancestors must be exactly 'none', found ${ancestors?.join(" ") ?? "none"}`
    );
  }

  // Play pages frame `/game-assets/*`, so same-origin framing must survive the
  // ancestor lockdown (which is carried by the sibling X-Frame-Options header).
  if (!cspSources(csp, "frame-src").includes("'self'")) {
    violations.push("CSP frame-src must still permit same-origin game iframes");
  }

  for (const { directive, sources } of REQUIRED_CSP_SOURCES) {
    const effective = cspSources(csp, directive);
    const missing = sources.filter((source) => !effective.includes(source));
    if (missing.length > 0) {
      violations.push(`CSP ${directive} must keep ${missing.join(" ")} for game loading`);
    }
  }

  for (const directive of WIDENING_DIRECTIVES) {
    const wildcard = cspSources(csp, directive).find((source) => WILDCARD_SOURCES.has(source));
    if (wildcard) violations.push(`CSP ${directive} must not be widened with ${wildcard}`);
  }

  if (cspSources(csp, "script-src").includes("'unsafe-eval'")) {
    violations.push("CSP script-src must prefer 'wasm-unsafe-eval' over 'unsafe-eval'");
  }
  if (!cspSources(csp, "object-src").includes("'none'")) {
    violations.push("CSP object-src must stay 'none'");
  }
  if (!(csp.get("base-uri") ?? []).includes("'none'")) {
    violations.push("CSP base-uri must stay 'none'");
  }
  if (!(csp.get("form-action") ?? []).includes("'none'")) {
    violations.push("CSP form-action must stay 'none'");
  }

  return violations;
}

/** A legal playable entry used to exercise the promotion gate. */
const trialPlayableGame: GameEntry = {
  ...games[0],
  slug: "trial-playable",
  route: "/trial-playable/",
  status: "playable",
  release: { kind: "static-web", version: "0.0.0-trial", entryFile: "index.html" }
};

describe("public/_headers security contract", () => {
  it("declares every rule in a shape Cloudflare parses", () => {
    const { rules, malformed } = parseHeaders(HEADERS_SOURCE);

    expect(malformed).toEqual([]);
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.map((rule) => rule.pattern)).toContain("/*");
  });

  it("denies framing with both X-Frame-Options and CSP frame-ancestors", () => {
    const { rules } = parseHeaders(HEADERS_SOURCE);
    const siteHeaders = effectiveHeaders(rules, "/");

    expect(siteHeaders.get("x-frame-options")).toBe("DENY");
    expect(siteHeaders.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });

  it("keeps the immutable /game-assets/* cache contract", () => {
    const { rules } = parseHeaders(HEADERS_SOURCE);
    const assetHeaders = effectiveHeaders(
      rules,
      "/game-assets/signal-garden/2026-09-21-58f2c29/Build/WebGL.wasm"
    );

    expect(rules.map((rule) => rule.pattern)).toContain("/game-assets/*");
    expect(assetHeaders.get("cache-control")).toBe("public, max-age=31536000, immutable");
  });

  it("holds the hardened policy that a playable promotion depends on", () => {
    expect(evaluatePromotionGate(HEADERS_SOURCE)).toEqual([]);
  });

  it("satisfies the gate for the real catalog and for a trial playable promotion", () => {
    const playable = games.filter((game) => game.status === "playable");

    // The trial entry is a legal promotion, so the gate is genuinely exercised.
    expect(validateCatalog([trialPlayableGame])).toEqual([]);
    expect([...playable, trialPlayableGame].length).toBeGreaterThan(0);

    // A trial playable value is admitted only while the defenses hold.
    expect(evaluatePromotionGate(HEADERS_SOURCE)).toEqual([]);
  });

  const weakeningEdits: { name: string; edit: (source: string) => string }[] = [
    {
      name: "removes X-Frame-Options",
      edit: (source) => source.replace(/^ *X-Frame-Options:.*$/gim, "")
    },
    {
      name: "downgrades X-Frame-Options to SAMEORIGIN",
      edit: (source) => source.replace(/X-Frame-Options: *DENY/i, "X-Frame-Options: SAMEORIGIN")
    },
    {
      name: "removes frame-ancestors",
      edit: (source) => source.replace(/ *frame-ancestors *'none';?/g, "")
    },
    {
      name: "relaxes frame-ancestors to 'self'",
      edit: (source) => source.replace(/frame-ancestors *'none'/, "frame-ancestors 'self'")
    },
    {
      name: "detaches the policy for a single route",
      edit: (source) =>
        `${source}\n/embed/*\n  ! Content-Security-Policy\n  X-Frame-Options: SAMEORIGIN\n`
    },
    {
      name: "drops wasm-unsafe-eval and breaks WebAssembly compilation",
      edit: (source) => source.replace(/ *'wasm-unsafe-eval'/, "")
    },
    {
      name: "drops blob: workers used by the Unity runtime",
      edit: (source) => source.replace(/;? *worker-src [^;]*/, "")
    },
    {
      name: "widens script-src with a wildcard",
      edit: (source) => source.replace(/script-src 'self'/, "script-src *")
    },
    {
      name: "swaps wasm-unsafe-eval for the broader unsafe-eval",
      edit: (source) => source.replace("'wasm-unsafe-eval'", "'unsafe-eval'")
    },
    {
      name: "drops object-src 'none'",
      edit: (source) => source.replace(/;? *object-src 'none'/, "")
    },
    {
      name: "introduces an unparseable header line",
      edit: (source) => source.replace(/^ *X-Frame-Options: DENY$/m, "  X-Frame-Options DENY")
    }
  ];

  it.each(weakeningEdits)("blocks promotion when an edit $name", ({ edit }) => {
    const weakened = edit(HEADERS_SOURCE);

    expect(weakened).not.toBe(HEADERS_SOURCE);
    expect(evaluatePromotionGate(weakened).length).toBeGreaterThan(0);
  });

  const equivalentEdits: { name: string; edit: (source: string) => string }[] = [
    {
      name: "drops connect-src, which default-src already covers",
      edit: (source) => source.replace(/;? *connect-src 'self'/, "")
    },
    {
      name: "drops frame-src, which default-src already covers",
      edit: (source) => source.replace(/;? *frame-src 'self'/, "")
    }
  ];

  it.each(equivalentEdits)("still admits promotion when an edit $name", ({ edit }) => {
    const edited = edit(HEADERS_SOURCE);

    expect(edited).not.toBe(HEADERS_SOURCE);
    expect(evaluatePromotionGate(edited)).toEqual([]);
  });
});
