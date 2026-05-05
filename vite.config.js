// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // VITE_BASE_PATH steuert den Unterpfad:
  //   XAMPP lokal → /azubiboard/
  //   Eigene Domain auf Root → /
  const base = process.env.VITE_BASE_PATH || '/azubiboard/';

  return {
    plugins: [react()],
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