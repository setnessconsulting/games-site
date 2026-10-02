import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateStaticAssets } from "../src/lib/static-assets";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const result = validateStaticAssets({ projectRoot });

if (result.violations.length > 0) {
  console.error(`Static asset validation failed with ${result.violations.length} violation(s):`);
  for (const violation of result.violations) {
    console.error(`  ${violation.message}`);
  }
  process.exit(1);
}

console.log(`Static assets valid: ${result.checkedReferences} public asset reference(s)`);
