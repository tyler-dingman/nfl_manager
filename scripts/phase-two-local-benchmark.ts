import { writeFile } from 'node:fs/promises';
import { hashPassword, verifyPassword } from '../src/server/auth/crypto';

async function measure(name: string, samples: number, operation: () => Promise<unknown> | unknown) {
  const wall: number[] = [],
    cpu: number[] = [];
  const rssBefore = process.memoryUsage().rss;
  for (let i = 0; i < samples; i++) {
    const before = process.cpuUsage(),
      start = performance.now();
    await operation();
    const used = process.cpuUsage(before);
    wall.push(performance.now() - start);
    cpu.push((used.user + used.system) / 1000);
  }
  wall.sort((a, b) => a - b);
  cpu.sort((a, b) => a - b);
  return {
    name,
    samples,
    medianWallMs: wall[Math.floor(samples / 2)],
    maxWallMs: Math.max(...wall),
    medianNodeProcessCpuMs: cpu[Math.floor(samples / 2)],
    maxNodeProcessCpuMs: Math.max(...cpu),
    rssBefore,
    rssAfter: process.memoryUsage().rss,
  };
}
async function main() {
  const encoded = await hashPassword('synthetic-password-for-local-benchmark');
  const results = [
    await measure('Argon2id existing password parameters', 10, () =>
      hashPassword('synthetic-password-for-local-benchmark'),
    ),
    await measure('Argon2id password verification', 10, () =>
      verifyPassword(encoded, 'synthetic-password-for-local-benchmark'),
    ),
  ];
  for (const bytes of [8000, 512000, 17510000]) {
    const raw = JSON.stringify({ synthetic: 'x'.repeat(bytes - 16) });
    results.push(
      await measure(`JSON parse and stringify ~${bytes} bytes`, 10, () =>
        JSON.stringify(JSON.parse(raw)),
      ),
    );
  }
  await writeFile(
    'reports/zero-cost-phase-2/local-cpu-benchmark.json',
    JSON.stringify(
      {
        scope:
          'MEASURED Node process CPU and wall time on this development machine. Includes native threads. Not Cloudflare Worker CPU, isolate memory, API latency or a production percentile.',
        runtime: process.version,
        architecture: process.arch,
        results,
      },
      null,
      2,
    ) + '\n',
  );
}
main().catch(() => {
  process.exitCode = 1;
});
