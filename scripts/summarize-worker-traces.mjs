import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import instrumentation from '../packages/storage/instrumentation.ts';
const {routeFamily}=instrumentation;
export function summarizeTraces(events) {
  const groups = new Map();
  let rejected = 0;
  for (const event of events) {
    const cpu = event.CPUTimeMs ?? event.$workers?.cpuTimeMs ?? event.cpuTimeMs,
      wall = event.WallTimeMs ?? event.$workers?.wallTimeMs ?? event.wallTimeMs;
    if (typeof cpu !== 'number' || !Number.isFinite(cpu) || cpu < 0) {
      rejected++;
      continue;
    }
    let path = 'other';
    try {
      path = new URL(
        event.Event?.request?.url ?? event.event?.request?.url ?? 'https://invalid.local/unknown',
      ).pathname;
    } catch {}
    const family = routeFamily(path),
      row = groups.get(family) ?? { route: family, samples: [], wallSamples: [], outcomes: {} };
    row.samples.push(cpu);
    if (typeof wall === 'number' && Number.isFinite(wall)) row.wallSamples.push(wall);
    const outcome = event.Outcome ?? event.outcome ?? event.$workers?.outcome ?? 'unknown';
    row.outcomes[outcome] = (row.outcomes[outcome] ?? 0) + 1;
    groups.set(family, row);
  }
  const percentile = (values, p) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)] ?? null;
  };
  return {
    scope:
      'Cloudflare-format export analysis. Confirm export provenance separately; synthetic fixtures cannot qualify production CPU.',
    rejected,
    groups: [...groups.values()].map((r) => ({
      route: r.route,
      count: r.samples.length,
      cpuP50Ms: percentile(r.samples, 0.5),
      cpuP95Ms: percentile(r.samples, 0.95),
      cpuP99Ms: percentile(r.samples, 0.99),
      cpuMaxMs: Math.max(...r.samples),
      wallP95Ms: percentile(r.wallSamples, 0.95),
      outcomes: r.outcomes,
    })),
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output)
    throw Error(
      'Usage: node --import tsx scripts/summarize-worker-traces.mjs <export.jsonl> <summary.json>',
    );
  const events = (await readFile(input, 'utf8'))
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  await writeFile(output, JSON.stringify(summarizeTraces(events), null, 2) + '\n');
}
