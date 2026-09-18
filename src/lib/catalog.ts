import type { GameEntry, GameRelease } from "../data/games";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SAFE_ASSET_SEGMENT = /^[A-Za-z0-9._-]+$/;

function isSafeRelativeAssetPath(path: string): boolean {
  if (!path || path.startsWith("/") || path.includes("\\")) return false;
  const segments = path.split("/");
  return segments.every(
    (segment) =>
      segment.length > 0 &&
      segment !== "." &&
      segment !== ".." &&
      SAFE_ASSET_SEGMENT.test(segment)
  );
}

function validateRelease(slug: string, release: GameRelease): string[] {
  const errors: string[] = [];

  if (!VERSION_PATTERN.test(release.version)) {
    errors.push(`${slug}: release version must be an immutable path-safe identifier`);
  }

  if (release.kind === "static-web") {
    if (!isSafeRelativeAssetPath(release.entryFile)) {
      errors.push(`${slug}: static-web entryFile must be a safe relative asset path`);
    }
    if (!release.entryFile.toLowerCase().endsWith(".html")) {
      errors.push(`${slug}: static-web entryFile must be an HTML document`);
    }
    return errors;
  }

  const files = [
    ["loaderFile", release.loaderFile],
    ["dataFile", release.dataFile],
    ["frameworkFile", release.frameworkFile],
    ["wasmFile", release.wasmFile]
  ] as const;
  for (const [field, value] of files) {
    if (!isSafeRelativeAssetPath(value) || value.includes("/")) {
      errors.push(`${slug}: unity-webgl ${field} must be a safe filename`);
    }
  }

  return errors;
}

export function validateCatalog(entries: readonly GameEntry[]): string[] {
  const errors: string[] = [];
  const slugs = new Set<string>();
  const routes = new Set<string>();

  for (const game of entries) {
    if (!SLUG_PATTERN.test(game.slug)) {
      errors.push(
        `${game.slug}: slug must contain lowercase letters, numbers, and hyphens only`
      );
    }

    if (slugs.has(game.slug)) {
      errors.push(`${game.slug}: duplicate slug`);
    }
    slugs.add(game.slug);

    if (!game.route.startsWith("/") || !game.route.endsWith("/")) {
      errors.push(`${game.slug}: route must start and end with /`);
    }

    if (routes.has(game.route)) {
      errors.push(`${game.slug}: duplicate route ${game.route}`);
    }
    routes.add(game.route);

    if (game.status === "playable" && !game.release) {
      errors.push(`${game.slug}: playable games require a release`);
    }

    if (game.status === "coming-soon" && game.release) {
      errors.push(`${game.slug}: coming-soon games cannot select a production release`);
    }

    if (game.release) {
      errors.push(...validateRelease(game.slug, game.release));
    }
  }

  return errors;
}
