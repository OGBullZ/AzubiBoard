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
      {
        name: 'redirect-to-base',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const url = req.url ?? '/';
            // Vite-interne Pfade (HMR, module graph) nicht anfassen
            if (url.startsWith('/@') || url.startsWith('/node_modules')) return next();
            // Alles ohne Base-Prefix → redirect zu /azubiboard/<rest>
            if (!url.startsWith(base)) {
              const rest = url.replace(/^\//, '');
              res.writeHead(302, { Location: base + rest });
              res.end();
              return;
            }
            next();
          });
        },
      },
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
              // L1: POST /api/data über Background-Sync queuen.
              //     Wenn der Browser offline ist (oder die Anfrage fehlschlägt),
              //     legt Workbox die Request in IndexedDB ab und wiederholt sie
              //     automatisch, sobald der Browser wieder online ist — auch
              //     wenn der Tab in der Zwischenzeit geschlossen wurde.
              urlPattern: ({ url }) => url.pathname.endsWith('/api/data'),
              method:     'POST',
              handler:    'NetworkOnly',
              options: {
                backgroundSync: {
                  name: 'azubiboard-save-queue',
                  options: {
                    maxRetentionTime: 24 * 60, // Minuten = 24 h
                  },
                },
              },
            },
            {
              // GET-Endpoints: Network-First (frische Daten, Cache-Fallback)
              urlPattern: ({ url, request }) => url.pathname.includes('/api/') && request.method === 'GET',
              handler:    'NetworkFirst',
              options: {
                cacheName:  'api-cache',
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
                networkTimeoutSeconds: 5,
              },
            },
          ],
          // Nicht den Service Worker bei Offline-Fehler abstürzen lassen
          skipWaiting:  true,
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
      historyApiFallback: {
        index: `${base}index.html`,
        rewrites: [{ from: /^\/azubiboard\/.*$/, to: `${base}index.html` }],
      },
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
      chunkSizeWarningLimit: 720,  // SPA-Monolith ist OK bis 720 kB
    },
  };
});
