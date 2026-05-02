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

    // Inline assets smaller than 4 KB — avoids extra fetches for SVG/tiny assets.
    assetsInlineLimit: 4096,

    // Source maps only for local debugging; strip in CI/production.
    sourcemap: false,
  },

  // Dev server mirrors the Capacitor androidScheme: 'https' setting.
  server: {
    port: 3000,
    strictPort: true,
  },
});
