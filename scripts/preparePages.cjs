const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const estateDir = path.join(rootDir, 'estate');
const deployDir = path.join(rootDir, '.pages-dist');

if (!fs.existsSync(estateDir)) {
  throw new Error('Build output not found at estate/. Run "pnpm build" first.');
}

fs.rmSync(deployDir, { recursive: true, force: true });
fs.mkdirSync(deployDir, { recursive: true });

const rootFiles = ['index.html', '404.html', '.nojekyll'];
for (const file of rootFiles) {
  const sourcePath = path.join(rootDir, file);
  if (!fs.existsSync(sourcePath)) {
    continue;
  }
  const targetPath = path.join(deployDir, file);
  fs.copyFileSync(sourcePath, targetPath);
}

fs.cpSync(estateDir, path.join(deployDir, 'estate'), {
  recursive: true,
});
