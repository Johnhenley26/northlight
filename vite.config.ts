import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API = 'http://127.0.0.1:3001';

// Hosts allowed to reach the dev server (the cloud preview hostname is passed in by
// the launcher). Never use a blanket wildcard here.
const allowedHosts = (process.env.NORTHLIGHT_ALLOWED_HOSTS || '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: allowedHosts.length ? allowedHosts : undefined,
    proxy: {
      '/api': { target: API, changeOrigin: false },
    },
  },
  build: {
    outDir: 'dist',
  },
});
