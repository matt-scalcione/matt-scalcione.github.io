import { cpSync, existsSync, mkdirSync, rmSync, copyFileSync } from 'fs'
import { resolve } from 'path'

const root = resolve(process.cwd())
const distDir = resolve(root, 'dist')
const rootIndex = resolve(root, 'index.html')
const assetsDir = resolve(root, 'assets')
const distIndex = resolve(distDir, 'index.html')
const distAssets = resolve(distDir, 'assets')
const distFavicon = resolve(distDir, 'vite.svg')
const rootFavicon = resolve(root, 'vite.svg')

if (!existsSync(distIndex)) {
  console.error('dist/index.html not found. Run `npm run build` first.')
  process.exit(1)
}

copyFileSync(distIndex, rootIndex)

if (existsSync(assetsDir)) {
  rmSync(assetsDir, { recursive: true, force: true })
}

if (existsSync(distAssets)) {
  mkdirSync(assetsDir, { recursive: true })
  cpSync(distAssets, assetsDir, { recursive: true })
  console.log('Copied static assets to root assets directory.')
} else {
  console.warn('No dist/assets directory found to copy.')
}

if (existsSync(distFavicon)) {
  copyFileSync(distFavicon, rootFavicon)
}

console.log('Updated root index.html from dist output.')
