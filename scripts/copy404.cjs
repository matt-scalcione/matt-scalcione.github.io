const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
fs.copyFileSync(path.join(root, 'estate', 'index.html'), path.join(root, 'estate', '404.html'));
