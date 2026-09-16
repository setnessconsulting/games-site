import { games } from "../src/data/games";
import { validateCatalog } from "../src/lib/catalog";

const errors = validateCatalog(games);
if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Catalog valid: ${games.length} entries`);
