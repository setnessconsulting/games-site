import { MOTION_LAB_SLUG, PLANETARY_SURVEY_SLUG, games } from "../data/games";

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

export interface ParsedAssetPath {
  slug: string;
  version: string;
  assetPath: string;
}

export interface ByteRange {
  start: number;
  end: number;
  length: number;
}

export function parseAssetPath(value: unknown): ParsedAssetPath | undefined {
  const segments = Array.isArray(value)
    ? value.filter((segment): segment is string => typeof segment === "string")
    : typeof value === "string"
      ? value.split("/")
      : [];

  const [slug, version, ...assetSegments] = segments;
  if (!slug || !version || assetSegments.length === 0) return undefined;
  if (!SAFE_SEGMENT.test(slug) || !SAFE_SEGMENT.test(version)) return undefined;
  if (
    assetSegments.some(
      (segment) => segment === "." || segment === ".." || !SAFE_SEGMENT.test(segment)
    )
  ) {
    return undefined;
  }

  return { slug, version, assetPath: assetSegments.join("/") };
}

export function isApprovedRelease(
  slug: string,
  version: string,
  allowFixture: boolean,
  bridgeBuilderPreviewVersion?: string,
  numberLineJumperPreviewVersion?: string,
  mathDetectivePreviewVersion?: string,
  weatherCommandPreviewVersion?: string,
  ecosystemRescuePreviewVersion?: string,
  fractionMatchPreviewVersion?: string,
  planetarySurveyPreviewVersion?: string,
  motionLabPreviewVersion?: string
): boolean {
  if (allowFixture && slug === "test-fixture" && version === "0.0.0") return true;

  if (
    slug === "bridge-builder" &&
    bridgeBuilderPreviewVersion &&
    version === bridgeBuilderPreviewVersion
  ) {
    return true;
  }

  if (
    slug === "number-line-jumper" &&
    numberLineJumperPreviewVersion &&
    version === numberLineJumperPreviewVersion
  ) {
    return true;
  }

  if (
    slug === "math-detective" &&
    mathDetectivePreviewVersion &&
    version === mathDetectivePreviewVersion
  ) {
    return true;
  }

  if (
    slug === "weather-command" &&
    weatherCommandPreviewVersion &&
    version === weatherCommandPreviewVersion
  ) {
    return true;
  }

  if (
    slug === "ecosystem-rescue" &&
    ecosystemRescuePreviewVersion &&
    version === ecosystemRescuePreviewVersion
  ) {
    return true;
  }

  if (
    slug === "fraction-match" &&
    fractionMatchPreviewVersion &&
    version === fractionMatchPreviewVersion
  ) {
    return true;
  }

  // Planetary Survey is not promoted, so this is the ONLY path that can approve one
  // of its assets: an exact preview pointer supplied by the deployment. The catalog
  // fallback below cannot approve it, because the entry has no `release` and is not
  // `playable`. A deployment that forgets to set the pointer serves nothing rather
  // than serving an unqualified candidate.
  if (
    slug === PLANETARY_SURVEY_SLUG &&
    planetarySurveyPreviewVersion &&
    version === planetarySurveyPreviewVersion
  ) {
    return true;
  }

  // Motion Lab was promoted by GAME-401 / ML-PROMOTE, so the catalog fallback below now
  // approves its promoted version. This branch is the deployment-only override: a preview
  // build can pin one exact candidate for a further qualification pass, exactly as the
  // other promoted static-web games do. It can approve a version that is NOT the promoted
  // one, which is why it is checked first and only for that exact string.
  if (slug === MOTION_LAB_SLUG && motionLabPreviewVersion && version === motionLabPreviewVersion) {
    return true;
  }

  return games.some(
    (game) => game.slug === slug && game.status === "playable" && game.release?.version === version
  );
}

export function buildAssetKey({ slug, version, assetPath }: ParsedAssetPath): string {
  return `${slug}/${version}/${assetPath}`;
}

export function parseByteRange(value: string | null, size: number): ByteRange | undefined {
  if (!value || size < 0) return undefined;

  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (match[1] === "" && match[2] === "")) return undefined;

  if (match[1] === "") {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0 || size === 0) return undefined;
    const start = Math.max(size - suffixLength, 0);
    return { start, end: size - 1, length: size - start };
  }

  const start = Number(match[1]);
  if (!Number.isSafeInteger(start) || start < 0 || start >= size) return undefined;

  const requestedEnd = match[2] === "" ? size - 1 : Number(match[2]);
  if (!Number.isSafeInteger(requestedEnd) || requestedEnd < start) return undefined;

  const end = Math.min(requestedEnd, size - 1);
  return { start, end, length: end - start + 1 };
}

export function fallbackContentType(assetPath: string): string {
  const lowerPath = assetPath.toLowerCase();
  if (lowerPath.endsWith(".wasm")) return "application/wasm";
  if (lowerPath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (lowerPath.endsWith(".json")) return "application/json; charset=utf-8";
  if (lowerPath.endsWith(".html")) return "text/html; charset=utf-8";
  if (lowerPath.endsWith(".css")) return "text/css; charset=utf-8";
  if (lowerPath.endsWith(".png")) return "image/png";
  if (lowerPath.endsWith(".jpg") || lowerPath.endsWith(".jpeg")) return "image/jpeg";
  if (lowerPath.endsWith(".webp")) return "image/webp";
  if (lowerPath.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}
