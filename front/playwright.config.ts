import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  use: { baseURL: "http://localhost:28004", headless: true },
  workers: 1,
  reporter: "list",
});
