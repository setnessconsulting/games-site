import type { GameEntry } from "../data/games";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RELEASE_FILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

function validReleaseFile(value: string): boolean {
  return (
    RELEASE_FILE_PATTERN.test(value) &&
    !value.split("/").some((part) => part === "..") &&
    !value.startsWith("/")
  );
}

export function validateCatalog(entries: readonly GameEntry[]): string[] {
  const errors: string[] = [];
  const slugs = new Set<string>();
  const routes = new Set<string>();

  for (const game of entries) {
    if (!SLUG_PATTERN.test(game.slug)) {
      errors.push(`${game.slug}: slug must contain lowercase letters, numbers, and hyphens only`);
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

    if (game.status === "playable" && !game.release?.version) {
      errors.push(`${game.slug}: playable games require a release version`);
    }

    if (game.status === "playable" && game.release) {
      if (!game.release.kind) errors.push(`${game.slug}: release kind is required`);
      if (game.release.kind === "static") {
        if (!validReleaseFile(game.release.entryFile)) {
          errors.push(`${game.slug}: static release entryFile must be a safe relative path`);
        }
        if (!validReleaseFile(game.release.manifestFile)) {
          errors.push(`${game.slug}: static release manifestFile must be a safe relative path`);
        }
      }
    }

    if (game.status === "coming-soon" && game.release) {
      errors.push(`${game.slug}: coming-soon games cannot publish a release version`);
    }
  }

  return errors;
}
