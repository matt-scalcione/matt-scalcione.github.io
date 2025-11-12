const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'estate');
fs.copyFileSync(path.join(root, 'index.html'), path.join(root, '404.html'));
