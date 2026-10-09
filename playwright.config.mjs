import { defineConfig } from "@playwright/test";

// E2E against the production build (npm run build -> docs/), served by `vite preview`.
// Phone-PWA viewport. Uses system Chrome (PW_CHROME) so no browser download is needed.
const PORT = Number(process.env.PW_PORT || 5198);
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PW_BASE_URL || `http://localhost:${PORT}/captain-feed/`,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    launchOptions: {
      executablePath: process.env.PW_CHROME || "/usr/bin/google-chrome",
      args: ["--no-sandbox"],
    },
  },
  webServer: process.env.PW_BASE_URL
    ? undefined
    : {
        command: `npx vite preview --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}/captain-feed/`,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
