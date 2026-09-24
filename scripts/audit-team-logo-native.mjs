import { createRequire } from 'node:module';
const require = createRequire(process.cwd() + '/package.json');
const { build } = require('esbuild');
const { chromium } = require('playwright');
const fs = require('fs');
const root = process.cwd();
fs.mkdirSync('/tmp/down-distance-logo-audit', { recursive: true });
const result = await build({
  stdin: {
    resolveDir: root,
    loader: 'tsx',
    contents: `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {TeamBrandedLogo} from './apps/mobile/components/team-branded-logo';import {TEAM_BRANDED_LOGO_URLS} from './src/lib/team-brand-themes';function App(){const [team,setTeam]=useState('ARI');return <><select onChange={e=>setTeam(e.target.value)}>{Object.keys(TEAM_BRANDED_LOGO_URLS).map(t=><option key={t}>{t}</option>)}</select><div id="header"><TeamBrandedLogo team={team} style={{width:104,height:46,marginVertical:3}}/></div><div id="drawer"><TeamBrandedLogo team={team} style={{width:132,height:68}}/></div></>};createRoot(document.getElementById('root')).render(<App/>);`,
  },
  bundle: true,
  write: false,
  jsx: 'automatic',
  alias: {
    react: root + '/apps/mobile/node_modules/react',
    'react-dom': root + '/apps/mobile/node_modules/react-dom',
    'react-native': root + '/apps/mobile/node_modules/react-native-web',
  },
  resolveExtensions: [
    '.web.tsx',
    '.web.ts',
    '.web.jsx',
    '.web.js',
    '.tsx',
    '.ts',
    '.jsx',
    '.js',
    '.json',
  ],
  define: { 'process.env.NODE_ENV': '"production"', __DEV__: 'false' },
});
const b = await chromium.launch();
try {
  const p = await b.newPage({ viewport: { width: 393, height: 852 } });
  p.on('pageerror', (e) => console.log(e));
  await p.setContent('<body style="background:#888"><div id="root"></div></body>');
  await p.addScriptTag({ content: result.outputFiles[0].text });
  await p.locator('#header svg').waitFor();
  let checks = [];
  for (const abbr of await p.locator('option').allTextContents()) {
    await p.locator('select').selectOption(abbr);
    for (const id of ['header', 'drawer']) {
      const box = await p.locator('#' + id + ' svg').boundingBox();
      if (box.width !== (id === 'header' ? 104 : 132) || box.height !== (id === 'header' ? 46 : 68))
        throw Error(JSON.stringify({ abbr, id, box }));
      checks.push({ abbr, id, box });
    }
  }
  await p.screenshot({ path: '/tmp/down-distance-logo-audit/native-web.png' });
  fs.writeFileSync(
    '/tmp/down-distance-logo-audit/native-results.json',
    JSON.stringify(checks, null, 2),
  );
  console.log('Passed 64 native component size checks through React Native Web');
} finally {
  await b.close();
}
