// playwright.config.js — E2E-Konfiguration
// Tests gegen den Vite-Dev-Server (Port 5173). Mode: localStorage-only
// (USE_API=false), damit kein PHP/MySQL nötig ist.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir:    './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries:    process.env.CI ? 2 : 0,
  workers:    process.env.CI ? 1 : undefined,
  reporter:   process.env.CI ? 'github' : 'list',
  timeout:    20_000,
  expect:     { timeout: 5_000 },

  use: {
    baseURL: 'http://localhost:4173/azubiboard/',
    trace:   'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    // Vite preview = produktions-Bundle. Schneller + deterministischer
    // als der Dev-Server (kein HMR-Overhead, kein React-Refresh).
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url:     'http://localhost:4173/azubiboard/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
