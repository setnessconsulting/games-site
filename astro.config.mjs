import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  site: "https://games.setnessconsulting.com",
  build: {
    format: "directory"
  }
});
