import { readFile, writeFile } from 'node:fs/promises';
const output: any = {
  scope:
    'Six final daily-cohort local measurements; separate emulator processes for A/B/C ran concurrently. Counts/page allocation measured; timings reflect local load, not isolated production latency.',
  results: {},
};
for (const strategy of ['A', 'B', 'C'])
  Object.assign(
    output.results,
    JSON.parse(await readFile(`measurements/zero-cost-${strategy}-benchmark.json`, 'utf8')).results,
  );
if (Object.keys(output.results).length !== 6) throw Error('Incomplete architecture comparison');
await writeFile('measurements/zero-cost-benchmark.json', JSON.stringify(output, null, 2) + '\n');
