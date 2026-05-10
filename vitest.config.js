// vitest.config.js — Test-Konfiguration getrennt von vite.config.js,
// damit der PWA-Plugin im Test nicht greift und Tests schnell starten.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{js,jsx}', 'tests/**/*.{test,spec}.{js,jsx}'],
    setupFiles: ['./tests/setup.js'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/lib/**/*.js'],
    },
  },
});
