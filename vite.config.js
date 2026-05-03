// vite.config.js
// Minimal Vite config for Crypt Raider.
// Produces a dist/ folder that matches capacitor.config.ts → webDir: 'dist'.
//
// Usage:
//   npm run build   → bundles to dist/
//   npm run dev     → dev server on :5173 with HMR

import { defineConfig } from 'vite';

export default defineConfig({
  // Serve from repo root in dev; produce dist/ on build.
  root: '.',
  base: './',           // relative paths so Capacitor's file:// scheme works

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',   // all target devices support ES modules natively

    rollupOptions: {
      input: {
        main: 'index.html',
      },
    },

    // Inline assets smaller than 8 KB; bump from 4 KB to reduce round trips
    // for small icon/font assets while keeping larger assets separately cacheable.
    assetsInlineLimit: 8192,

    // Source maps controlled by environment variable — no file edit needed in CI.
    // Set VITE_SOURCEMAP=true in CI to enable.
    sourcemap: process.env.VITE_SOURCEMAP === 'true',
  },

  // Dev server mirrors the Capacitor androidScheme: 'https' setting.
  server: {
    port: 3000,
    strictPort: true,
  },
});
