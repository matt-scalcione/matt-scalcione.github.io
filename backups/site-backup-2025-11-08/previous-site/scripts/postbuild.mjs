import { copyFile } from 'node:fs/promises'
import { join } from 'node:path'

const distDir = new URL('../dist', import.meta.url)
const indexPath = join(distDir.pathname, 'index.html')
const fallbackPath = join(distDir.pathname, '404.html')

try {
  await copyFile(indexPath, fallbackPath)
  console.log('Created SPA fallback 404.html')
} catch (error) {
  console.error('Failed to create SPA fallback page', error)
  process.exitCode = 1
}
