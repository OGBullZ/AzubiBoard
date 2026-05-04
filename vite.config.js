// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    proxy: {
      // Im Dev-Modus: /api → PHP-Server (XAMPP o.ä.)
      '/api': {
        target:       process.env.VITE_PHP_DEV_URL || 'http://localhost:8080',
        changeOrigin: true,
        secure:       false,
      },
    },
  },
  build: {
    outDir:    'dist',
    sourcemap: false,
  },
  base: '/',
});