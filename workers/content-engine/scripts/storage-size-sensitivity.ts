import { gzipSync } from 'node:zlib';
import { writeFile } from 'node:fs/promises';
// Same deterministic maximum-size source used in the round-trip test. No fetched content.
let state = 7,
  text = '';
while (text.length < 490000) {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  text += state.toString(36);
}
const raw = new TextEncoder().encode(text.slice(0, 490000));
let compressed = 0,
  chunks = 0;
for (let at = 0; at < raw.length; at += 4096) {
  const part = raw.slice(at, at + 4096),
    zipped = gzipSync(part);
  compressed += Math.min(part.length, zipped.length);
  chunks++;
}
const cases = Object.fromEntries(
  [30, 90, 180, 365, 730, 1095, 1825].map((d) => [
    d,
    {
      sourceOnlyR2BytesAt200NewUniqueCandidatesDaily: compressed * 200 * Math.max(0, d - 30),
      rawSourceBytes: raw.length * 200 * d,
    },
  ]),
);
const output = {
  scope:
    'Worst-valid-source sensitivity, not typical workload. Node gzip byte sizes, not Worker CPU. Excludes trees, stories, editions, backups, retries and recovery; source-only storage lower bound. No assumption that all real sources are this large.',
  rawBytesPerCandidate: raw.length,
  compressedChunkBytesPerCandidate: compressed,
  chunksPerCandidate: chunks,
  projections: cases,
};
await writeFile(
  'measurements/storage-size-sensitivity.json',
  JSON.stringify(output, null, 2) + '\n',
);
console.log(JSON.stringify(output, null, 2));
