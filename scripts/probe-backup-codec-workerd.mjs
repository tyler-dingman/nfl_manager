import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `import {sealDirectory,unsealDirectory} from './packages/storage/backup-codec';export default {async fetch(request){const value=await request.json(),secret='synthetic-workerd-codec-key-at-least-32-characters';const start=performance.now();const old=await sealDirectory(value,secret), compact=await sealDirectory(value,secret,'binary-v2');const restored=await unsealDirectory(compact,secret);if(JSON.stringify(restored)!==JSON.stringify(value))throw Error('Lossy restore');let rejected=false;try{await unsealDirectory({...compact,cipher:(compact.cipher[0]==='A'?'B':'A')+compact.cipher.slice(1)},secret);}catch{rejected=true;}return Response.json({beforeEnvelopeBytes:JSON.stringify(old).length,afterEnvelopeBytes:JSON.stringify(compact).length,corruptionRejected:rejected,localWorkerWallMs:performance.now()-start,cpuMs:null});}};`,
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
});
const mf = new Miniflare(
  convertV4MiniflareOptions({
    modules: true,
    script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-10-18',
    outboundService: () => new Response(null, { status: 403 }),
  }),
);
const samples = [];
try {
  for (const [name, value] of [
    ['tiny', { id: 'exact' }],
    [
      'large-Unicode',
      Array.from({ length: 2000 }, (_, i) => ({
        id: 'original-' + i,
        text: 'Original 🏈 text '.repeat(30),
      })),
    ],
    ['high-entropy', { value: Array.from(crypto.getRandomValues(new Uint8Array(60000))) }],
  ]) {
    const response = await mf.dispatchFetch('https://synthetic.test', {
      method: 'POST',
      body: JSON.stringify(value),
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.corruptionRejected, true);
    samples.push({ name, ...result });
  }
} finally {
  await mf.dispose();
}
await writeFile(
  'reports/final-staging/codec-workerd.json',
  JSON.stringify({ runtime: 'actual local workerd', hostedCPU: null, samples }, null, 2),
);
console.log(samples);
