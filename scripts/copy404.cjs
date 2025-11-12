const fs = require('fs');
const path = require('path');

const source = path.resolve(__dirname, '../estate/index.html');
const target = path.resolve(__dirname, '../estate/404.html');

fs.copyFileSync(source, target);
