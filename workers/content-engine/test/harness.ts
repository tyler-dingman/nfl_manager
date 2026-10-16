import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { URL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EditorialDatabase } from '../src/database';
import { EditorialRepository } from '../src/repository';
import { EditorialJobs } from '../src/jobs';
export async function harness(persistent = false, compact = true, maxMigration = 999) {
  const directory = await mkdtemp(join(tmpdir(), 'dd-editorial-synthetic-'));
  const options = {
    name: 'editorial-local-test',
    modules: true,
    script: 'export default {fetch(){return new Response("No content API",{status:404})}}',
    compatibilityDate: '2026-01-01',
    d1Databases: { EDITORIAL_DB: 'editorial-synthetic-only' },
    resourcePersistencePath: persistent ? directory : undefined,
    telemetry: { enabled: false },
    outboundService: () => new Response('External network disabled', { status: 403 }),
  };
  let mf = new Miniflare(convertV4MiniflareOptions(options));
  const binding = await mf.getD1Database('EDITORIAL_DB');
  const db = new EditorialDatabase(binding as unknown as D1Database);
  const repo = new EditorialRepository(db, compact),
    jobs = new EditorialJobs(db, compact);
  for (const file of (await readdir(new URL('../migrations/', import.meta.url)))
    .filter((f) => f.endsWith('.sql') && Number(f.slice(0, 4)) <= maxMigration)
    .sort()) {
    const migration = await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8');
    // This schema deliberately contains no triggers or semicolons inside literals.
    for (const statement of migration
      .replace(/^--.*$/gm, '')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean))
      await binding.prepare(statement).run();
  }
  return {
    mf,
    binding,
    db,
    repo,
    jobs,
    directory,
    options,
    async restart() {
      await mf.dispose();
      mf = new Miniflare(convertV4MiniflareOptions(options));
      return await mf.getD1Database('EDITORIAL_DB');
    },
    async close() {
      await mf.dispose();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
