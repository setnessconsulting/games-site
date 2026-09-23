import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { formatViolation, intentionalRoutes, validateRoutes } from "../src/lib/routes";

// Resolve the package root from this file so the script behaves the same no
// matter which working directory it is invoked from.
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const result = validateRoutes({ projectRoot });

for (const note of result.notes) {
  console.warn(`note: ${note}`);
}

if (result.violations.length > 0) {
  console.error(`Route validation failed with ${result.violations.length} violation(s):`);
  for (const violation of result.violations) {
    console.error(`  [${violation.id}] ${formatViolation(violation)}`);
  }
  process.exit(1);
}

console.log(
  `Routes valid: ${result.routeCount} site route(s), ${result.functionRoutes.length} Pages Function route prefix(es), ${intentionalRoutes.length} intentional non-page route(s)`
);
