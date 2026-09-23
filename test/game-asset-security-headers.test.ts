import { describe, expect, it } from "vitest";
import {
  applyGameAssetDocumentSecurityHeaders,
  GAME_ASSET_DOCUMENT_CSP,
  GAME_ASSET_DOCUMENT_X_FRAME_OPTIONS,
  GAME_ASSET_IMMUTABLE_CACHE_CONTROL,
  isHtmlContentType
} from "../src/lib/game-asset-security-headers";

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
  "worker-src": ["child-src", "script-src", "default-src"],
  "media-src": ["default-src"]
};

function cspSources(csp: Map<string, string[]>, directive: string): string[] {
  const candidates = [directive, ...(CSP_FALLBACK_CHAINS[directive] ?? ["default-src"])];
  for (const candidate of candidates) {
    const sources = csp.get(candidate);
    if (sources) return sources;
  }
  return [];
}

const REQUIRED_CSP_SOURCES: { directive: string; sources: string[] }[] = [
  { directive: "script-src", sources: ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'"] },
  { directive: "style-src", sources: ["'self'", "'unsafe-inline'"] },
  { directive: "connect-src", sources: ["'self'"] },
  { directive: "worker-src", sources: ["'self'", "blob:"] },
  { directive: "media-src", sources: ["'self'", "blob:"] }
];

const WIDENING_DIRECTIVES = [
  "default-src",
  "script-src",
  "style-src",
  "connect-src",
  "frame-src",
  "worker-src",
  "media-src",
  "img-src",
  "font-src"
];

const WILDCARD_SOURCES = new Set(["*", "http:", "https:", "ws:", "wss:"]);

/**
 * Promotion-style gate for the Function-emitted HTML document policy.
 * Evaluates effective CSP sources (with fallbacks), not raw string equality.
 */
function evaluateDocumentPolicy(cspValue: string, xFrameOptions: string | null): string[] {
  const violations: string[] = [];

  if (xFrameOptions?.toUpperCase() !== "SAMEORIGIN") {
    violations.push(
      `document X-Frame-Options must be SAMEORIGIN (same-origin play iframes), found ${xFrameOptions ?? "nothing"}`
    );
  }

  if (!cspValue) {
    violations.push("document Content-Security-Policy is missing");
    return violations;
  }

  const csp = parseCsp(cspValue);
  const ancestors = csp.get("frame-ancestors");
  if (ancestors?.length !== 1 || ancestors[0] !== "'self'") {
    violations.push(
      `frame-ancestors must be exactly 'self' for embeddable game documents, found ${ancestors?.join(" ") ?? "none"}`
    );
  }
  if (ancestors?.includes("'none'")) {
    violations.push("frame-ancestors 'none' would break same-origin play iframes");
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

describe("game-asset document security headers", () => {
  it("recognizes HTML content types with charset parameters", () => {
    expect(isHtmlContentType("text/html")).toBe(true);
    expect(isHtmlContentType("text/html; charset=utf-8")).toBe(true);
    expect(isHtmlContentType("TEXT/HTML; charset=UTF-8")).toBe(true);
    expect(isHtmlContentType("application/wasm")).toBe(false);
    expect(isHtmlContentType("text/javascript; charset=utf-8")).toBe(false);
    expect(isHtmlContentType(null)).toBe(false);
  });

  it("holds the hardened document policy play embeds depend on", () => {
    expect(
      evaluateDocumentPolicy(GAME_ASSET_DOCUMENT_CSP, GAME_ASSET_DOCUMENT_X_FRAME_OPTIONS)
    ).toEqual([]);
  });

  it("applies document policy without changing the immutable cache contract", () => {
    const headers = new Headers({
      "cache-control": GAME_ASSET_IMMUTABLE_CACHE_CONTROL,
      "content-type": "text/html; charset=utf-8",
      etag: '"abc123"'
    });

    applyGameAssetDocumentSecurityHeaders(headers);

    expect(headers.get("cache-control")).toBe(GAME_ASSET_IMMUTABLE_CACHE_CONTROL);
    expect(headers.get("etag")).toBe('"abc123"');
    expect(headers.get("x-frame-options")).toBe(GAME_ASSET_DOCUMENT_X_FRAME_OPTIONS);
    expect(headers.get("content-security-policy")).toBe(GAME_ASSET_DOCUMENT_CSP);
    expect(
      evaluateDocumentPolicy(
        headers.get("content-security-policy") ?? "",
        headers.get("x-frame-options")
      )
    ).toEqual([]);
  });

  const weakeningEdits: { name: string; edit: (csp: string, xfo: string) => [string, string] }[] = [
    {
      name: "downgrades X-Frame-Options to DENY and breaks play iframes",
      edit: (csp) => [csp, "DENY"]
    },
    {
      name: "relaxes frame-ancestors to allow any parent",
      edit: (csp, xfo) => [csp.replace("frame-ancestors 'self'", "frame-ancestors *"), xfo]
    },
    {
      name: "locks frame-ancestors to 'none' and breaks play iframes",
      edit: (csp, xfo) => [csp.replace("frame-ancestors 'self'", "frame-ancestors 'none'"), xfo]
    },
    {
      name: "drops wasm-unsafe-eval and breaks WebAssembly compilation",
      edit: (csp, xfo) => [csp.replace(/ *'wasm-unsafe-eval'/, ""), xfo]
    },
    {
      name: "drops blob: workers used by the Unity runtime",
      edit: (csp, xfo) => [csp.replace(/;? *worker-src [^;]*/, ""), xfo]
    },
    {
      name: "drops blob: media used by Unity audio",
      edit: (csp, xfo) => [csp.replace(/;? *media-src [^;]*/, ""), xfo]
    },
    {
      name: "widens script-src with a wildcard",
      edit: (csp, xfo) => [csp.replace("script-src 'self'", "script-src *"), xfo]
    },
    {
      name: "swaps wasm-unsafe-eval for the broader unsafe-eval",
      edit: (csp, xfo) => [csp.replace("'wasm-unsafe-eval'", "'unsafe-eval'"), xfo]
    }
  ];

  it.each(weakeningEdits)("flags a policy that $name", ({ edit }) => {
    const [csp, xfo] = edit(GAME_ASSET_DOCUMENT_CSP, GAME_ASSET_DOCUMENT_X_FRAME_OPTIONS);

    expect([csp, xfo]).not.toEqual([GAME_ASSET_DOCUMENT_CSP, GAME_ASSET_DOCUMENT_X_FRAME_OPTIONS]);
    expect(evaluateDocumentPolicy(csp, xfo).length).toBeGreaterThan(0);
  });
});
