// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  // VITE_BASE_PATH steuert den Unterpfad:
  //   XAMPP lokal → /azubiboard/
  //   Eigene Domain auf Root → /
  const base = process.env.VITE_BASE_PATH || '/azubiboard/';

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['pwa-icon.svg', 'vite.svg'],
        manifest: {
          name: 'AzubiBoard',
          short_name: 'AzubiBoard',
          description: 'Ausbildungs-Management: Projekte, Aufgaben & Berichte',
          theme_color: '#6366f1',
          background_color: '#0f1117',
          display: 'standalone',
          start_url: base,
          scope: base,
          orientation: 'portrait-primary',
          icons: [
            {
              src: 'pwa-icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
            {
              src: 'pwa-icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'maskable',
            },
          ],
          categories: ['productivity', 'education'],
        },
        workbox: {
          // Cache-Strategie: App-Shell offline fähig
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          runtimeCaching: [
            {
              // API-Calls: Network-First (frische Daten bevorzugt, Fallback auf Cache)
              urlPattern: ({ url }) => url.pathname.includes('/api/'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
                networkTimeoutSeconds: 5,
              },
            },
          ],
          // Nicht den Service Worker bei Offline-Fehler abstürzen lassen
          skipWaiting: true,
          clientsClaim: true,
        },
        devOptions: {
          // Im Dev-Modus PWA aktiv (für Tests)
          enabled: false,
        },
      }),
    ],
    base,
    server: {
      port: 5173,
      strictPort: true,
      host: true,
      proxy: {
        // Dev: /azubiboard/api → XAMPP PHP
        [`${base}api`]: {
          target:       process.env.VITE_PHP_DEV_URL || 'http://localhost',
          changeOrigin: true,
          secure:       false,
          rewrite:      path => path,
        },
      },
    },
    build: {
      outDir:              'dist',
      sourcemap:           false,
      chunkSizeWarningLimit: 600,  // SPA-Monolith ist OK bis 600 kB
    },
  };
});
