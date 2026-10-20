import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
const out = process.env.DD_PROFILE_OUT ?? 'reports/firebase-cpu-root-cause';
assert(
  (await readFile('/private/tmp/dd-api-profile/worker.mjs')).equals(
    await readFile('workers/api/dist/worker.mjs'),
  ),
  'Source map must match API bundle',
);
const map = new TraceMap(
  JSON.parse(await readFile('/private/tmp/dd-api-profile/worker.mjs.map', 'utf8')),
);
const summary = JSON.parse(await readFile(out + '/workerd-profile-summary.json', 'utf8')),
  rows = [];
if (summary.bundleSha256)
  assert.equal(
    summary.bundleSha256,
    createHash('sha256')
      .update(await readFile('workers/api/dist/worker.mjs'))
      .digest('hex'),
  );
for (const row of summary.rows) {
  const p = JSON.parse(await readFile(out + '/' + row.profile, 'utf8'));
  const nodes = new Map(
    p.nodes.map((n) => {
      const f = n.callFrame;
      const position =
        f.url.endsWith('worker.mjs') && f.lineNumber >= 0 && f.columnNumber >= 0
          ? originalPositionFor(map, { line: f.lineNumber + 1, column: f.columnNumber })
          : null;
      return [
        n.id,
        {
          ...n,
          frame: {
            name: position?.name ?? f.functionName,
            source: position?.source?.replace(/^.*down-distance-rc3\//, '') ?? f.url,
            line: position?.line ?? f.lineNumber + 1,
          },
        },
      ];
    }),
  );
  for (const n of nodes.values()) for (const c of n.children ?? []) nodes.get(c).parent = n.id;
  const self = new Map(),
    categories = {};
  let idle = 0,
    active = 0;
  function category(n) {
    if (n.frame.name === '(idle)') return 'idle';
    if (n.frame.name === '(garbage collector)') return 'gc';
    if (n.frame.name === '(program)') return 'unattributed-native/program';
    const stack = [];
    let cur = n;
    while (cur) {
      stack.push(cur.frame);
      cur = nodes.get(cur.parent);
    }
    for (const f of stack) {
      const source = f.source ?? '',
        name = f.name ?? '';
      if (/jose\/.*(jwks|jwk_to_key|import|normalize_key)/.test(source) || name === 'importKey')
        return 'key retrieval/import/parse';
      if (/jose\/.*jwt_claims_set/.test(source)) return 'JWT claim validation/decoding';
      if (
        /node-internal:crypto|node_modules\/jose\/|src\/server\/auth\/crypto/.test(source) ||
        ['verify', 'digest', 'HmacHandle', 'CipherHandle', 'HashHandle', 'randomBytes'].includes(
          name,
        )
      )
        return 'crypto/JWT';
      if (/cloudflare-internal:d1-api|packages\/storage\//.test(source))
        return 'D1 client/storage orchestration';
      if (
        /src\/server\/auth\/(config|firebase-config)/.test(source) ||
        name === 'applicationEnvironment'
      )
        return 'configuration';
      if (
        /node_modules\/next|src\/middleware|node-internal:streams|node-internal:internal_(streams|buffer)/.test(
          source,
        )
      )
        return 'framework/request/runtime';
      if (/src\/server\/auth\/performance/.test(source)) continue;
      if (/src\/server\/auth|src\/app\/api\/auth/.test(source)) return 'auth/session orchestration';
    }
    if (stack.some((f) => ['json', 'parse', 'stringify', 'text'].includes(f.name)))
      return 'serialization/body transport';
    return 'other runtime/application';
  }

  for (let i = 0; i < (p.samples ?? []).length; i++) {
    const id = p.samples[i],
      n = nodes.get(id),
      cat = category(n);
    categories[cat] = (categories[cat] ?? 0) + 1;
    if (cat === 'idle') idle++;
    else active++;
    self.set(id, (self.get(id) ?? 0) + 1);
  }
  const top = [...self]
    .map(([id, samples]) => ({
      ...nodes.get(id).frame,
      samples,
      category: category(nodes.get(id)),
    }))
    .sort((a, b) => b.samples - a.samples);
  rows.push({
    operation: row.operation,
    totalSamples: p.samples.length,
    idleSamples: idle,
    nonIdleSamples: active,
    categories,
    topSelf: top.slice(0, 35),
  });
}
await writeFile(
  out + '/mapped-profile-summary.json',
  JSON.stringify(
    {
      source:
        'Local V8 statistical sample COUNTS, not millisecond accounting. Coarse categories based on closest mapped synchronous stack. Async continuations/native off-thread work can be unattributed. No sum of elapsed stage spans.',
      sourceMapMatchesProductionBundle: true,
      rows,
    },
    null,
    2,
  ) + '\n',
);
for (const row of rows) {
  console.log(row.operation, JSON.stringify(row.categories));
  console.log(JSON.stringify(row.topSelf.slice(0, 8)));
}
