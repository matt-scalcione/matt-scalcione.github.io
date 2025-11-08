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
const distAppConfig = resolve(distDir, 'app-config.js')
const rootAppConfig = resolve(root, 'app-config.js')
const prodAppConfig = resolve(root, 'public', 'app-config.prod.js')

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

if (existsSync(prodAppConfig)) {
  copyFileSync(prodAppConfig, distAppConfig)
  copyFileSync(prodAppConfig, rootAppConfig)
  console.log('Copied production app config to dist and root directories.')
} else {
  console.warn('Production app config file not found; skipped copying app-config.js.')
}

console.log('Updated root index.html from dist output.')
