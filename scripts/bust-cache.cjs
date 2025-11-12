const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const p = path.join(root, 'estate', 'index.html');
let html = fs.readFileSync(p, 'utf8');
const v = Date.now();
html = html.replace(/(\.js)(\"|\')/g, `$1?v=${v}$2`);
html = html.replace(/(\.css)(\"|\')/g, `$1?v=${v}$2`);
fs.writeFileSync(p, html);
console.log('Cache-busted tags with v=', v);
