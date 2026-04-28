// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,           // Standard-Port
    strictPort: true,     // Fehlermeldung statt automatischer Port-Änderung
    host: true,           // Zugänglich im Netzwerk (falls gewünscht)
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  base: '/netplan'  
});