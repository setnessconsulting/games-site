import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateBuiltLinks } from "../src/lib/built-html-links";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const result = validateBuiltLinks({ projectRoot });

if (result.violations.length > 0) {
  console.error(`Built HTML link validation failed with ${result.violations.length} violation(s):`);
  for (const violation of result.violations) {
    console.error(`  ${violation.message}`);
  }
  process.exit(1);
}

console.log(
  `Built HTML links valid: ${result.htmlFiles} HTML file(s), ${result.checkedReferences} internal reference(s)`
);
