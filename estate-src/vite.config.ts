import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/estate/',
  plugins: [react()],
  build: {
    outDir: '../estate',
    assetsDir: 'assets',
    target: ['es2018', 'safari14'],
    cssTarget: 'safari14',
    sourcemap: false,
  },
});
