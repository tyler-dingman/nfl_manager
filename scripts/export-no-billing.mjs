/** Owner-managed frozen logical export. Supports FTS virtual tables, excludes
 * their internal shadow tables. Read-only; invocation required, never scheduled. */
import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const quote = (name) => '"' + name.replaceAll('"', '""') + '"';
const literal = (v) =>
  v === null
    ? 'NULL'
    : typeof v === 'number' && Number.isFinite(v)
      ? String(v)
      : typeof v === 'string'
        ? "'" + v.replaceAll("'", "''") + "'"
        : (() => {
            throw Error('Unsupported export value');
          })();
export async function logicalExport(query) {
  const tables = await query(
    "SELECT s.name,s.sql FROM sqlite_schema s JOIN pragma_table_list p ON p.name=s.name AND p.schema='main' WHERE s.type='table' AND p.type IN ('table','virtual') AND s.name NOT LIKE 'sqlite_%' AND s.name NOT LIKE '_cf_%' AND s.name NOT LIKE 'd1_%' ORDER BY s.rowid",
  );
  const sql = ['PRAGMA defer_foreign_keys=ON;'];
  for (const table of tables) {
    sql.push(table.sql + ';');
    for (let offset = 0; ; offset += 100) {
      const rows = await query(`SELECT * FROM ${quote(table.name)} LIMIT 100 OFFSET ${offset}`);
      for (const row of rows)
        sql.push(
          `INSERT INTO ${quote(table.name)}(${Object.keys(row).map(quote).join(',')}) VALUES(${Object.values(row).map(literal).join(',')});`,
        );
      if (rows.length < 100) break;
    }
  }
  for (const index of await query(
    "SELECT sql FROM sqlite_schema WHERE type='index' AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ))
    sql.push(index.sql + ';');
  return Buffer.from(sql.join('\n') + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, config, output, confirmation, persist] = process.argv.slice(2);
  if (
    !['--local', '--remote'].includes(mode) ||
    confirmation !== 'OFFLINE_WRITERS_STOPPED' ||
    !output
  )
    throw Error(
      'Usage: --local|--remote CONFIG OUTPUT OFFLINE_WRITERS_STOPPED [LOCAL_PERSIST_DIR]',
    );
  // Explicit --remote is an owner-only future operation, not used by validation.
  if (mode === '--remote' && process.env.DD_OWNER_READ_ONLY_EXPORT !== 'I_HAVE_STOPPED_ALL_WRITERS')
    throw Error('Remote export requires explicit owner acknowledgement');
  function query(command) {
    const args = [
      'node_modules/wrangler/bin/wrangler.js',
      'd1',
      'execute',
      'APP_DB',
      mode,
      '--config',
      config,
      '--command',
      command,
      '--json',
    ];
    if (mode === '--local' && persist) args.push('--persist-to', persist);
    const r = spawnSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 32_000_000 });
    if (r.status !== 0) throw Error('Read-only export query failed: ' + r.stderr);
    const results = JSON.parse(r.stdout);
    if (results.some((r) => !r.success)) throw Error('Export failed');
    return results.flatMap((r) => r.results);
  }
  await writeFile(output, await logicalExport(query), { flag: 'wx', mode: 0o600 });
}
