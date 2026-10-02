// Regenerate native SVG sources from the same artwork used by lab-icons.tsx on web.
const fs = require('node:fs');
const path = require('node:path');
const names = ['stats', 'experiment', 'data', 'insights', 'parlay', 'test-tube', 'trends'];
const icons = Object.fromEntries(names.map(name => [name, fs.readFileSync(path.join(__dirname, '../../../public/assets/parlay-lab-science-icons', name + '.svg'), 'utf8')]));
fs.writeFileSync(path.join(__dirname, '../lib/parlay-icon-assets.json'), JSON.stringify(icons, null, 2) + '\n');
