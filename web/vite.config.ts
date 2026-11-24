/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const apiProxy = { '/api': { target: process.env.API_URL ?? 'http://localhost:5149', changeOrigin: false } };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  build: {
    // Never inline fonts as data: URIs; the production CSP only allows fonts from 'self'.
    assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined),
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: { allow: ['..'] },
    // The browser only ever talks to its own origin. In development Vite forwards /api to the .NET API, and in
    // production the web server does the same, so cookies stay first-party and CORS is never needed.
    proxy: apiProxy,
  },
  preview: { port: 4173, strictPort: true, proxy: apiProxy },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
