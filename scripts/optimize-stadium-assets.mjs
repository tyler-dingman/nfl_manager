import sharp from 'sharp';
import { readFile, writeFile, stat } from 'node:fs/promises';
const source = await readFile('src/config/game-day-hero.ts', 'utf8');
const files = [...source.matchAll(/'([^']+\/gameday\.(?:png|webp))'/g)].map(
  (m) => 'public' + m[1].replace(/\.webp$/, '.png'),
);
const results = [];
for (const file of [...new Set(files)]) {
  const output = file.replace(/\.png$/, '.webp');
  const original = await sharp(file).metadata();
  await sharp(file).webp({ quality: 82, effort: 6 }).toFile(output);
  const optimized = await sharp(output).metadata();
  if (original.width !== optimized.width || original.height !== optimized.height)
    throw Error('Dimensions changed');
  results.push({
    source: file,
    output,
    width: original.width,
    height: original.height,
    beforeBytes: (await stat(file)).size,
    afterBytes: (await stat(output)).size,
  });
}
await writeFile(
  'reports/performance/stadium-assets.json',
  JSON.stringify(
    {
      scope:
        'Measured local same-resolution WebP compression at quality 82. All originals retained. No AI regeneration or visual redesign.',
      results,
      beforeBytes: results.reduce((n, r) => n + r.beforeBytes, 0),
      afterBytes: results.reduce((n, r) => n + r.afterBytes, 0),
    },
    null,
    2,
  ) + '\n',
);
