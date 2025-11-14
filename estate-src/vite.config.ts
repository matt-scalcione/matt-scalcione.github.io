import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  base: '/estate/',
  plugins: [
    react(),
    legacy({
      targets: ['defaults', 'not IE 11', 'iOS >= 12', 'Safari >= 12'],
      modernPolyfills: true,
      renderLegacyChunks: true,
    }),
  ],
  build: {
    outDir: '../estate',
    assetsDir: 'assets',
    target: ['es2015'],
    cssTarget: 'safari14',
    minify: 'terser',
    terserOptions: { safari10: true, ecma: 2015 },
    sourcemap: false,
  },
});
