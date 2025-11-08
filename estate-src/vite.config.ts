import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/estate/',
  plugins: [react()],
  build: {
    outDir: '../estate',
    emptyOutDir: true,
  },
})
