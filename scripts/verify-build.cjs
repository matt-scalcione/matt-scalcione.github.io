const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'estate', 'assets');
const files = fs.readdirSync(dir).filter(f => /^index-.*\.js$/.test(f));
if (!files.length) throw new Error('No built index-*.js found in estate/assets');

const p = path.join(dir, files[0]);
const txt = fs.readFileSync(p, 'utf8').trimStart();
const first = txt[0];

if (first === '{') {
  throw new Error(`Asset ${files[0]} starts with "{". That is not valid JS (likely JSON or corrupt).`);
}
if (first === '<') {
  throw new Error(`Asset ${files[0]} starts with "<". That is HTML (likely a 404 or wrong file).`);
}
console.log('OK:', files[0], 'starts with', JSON.stringify(first));
