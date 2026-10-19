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
      : Array.isArray(v) && v.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)
        ? "X'" + Buffer.from(v).toString('hex') + "'"
        : v instanceof ArrayBuffer
          ? "X'" + Buffer.from(v).toString('hex') + "'"
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
    const columns = await query(`PRAGMA table_info(${quote(table.name)})`);
    if (columns.some((c) => c.name === '_dd_scan_cursor'))
      throw Error('Export cursor schema conflict');
    const blobColumns = columns.filter((c) => /BLOB/i.test(c.type)).map((c) => c.name);
    const extra = blobColumns
      .map(
        (c, i) =>
          `,hex(${quote(c)}) AS ${quote('_dd_blob_' + i)},typeof(${quote(c)}) AS ${quote('_dd_type_' + i)}`,
      )
      .join('');
    const without = /\bWITHOUT\s+ROWID\b/i.test(table.sql),
      keys = without
        ? columns
            .filter((c) => c.pk)
            .sort((a, b) => a.pk - b.pk)
            .map((c) => c.name)
        : [];
    if (without && !keys.length) throw Error('Export primary key required');
    let cursor;
    for (;;) {
      const order = without ? keys.map(quote).join(',') : 'rowid';
      const predicate = cursor
        ? without
          ? `WHERE (${order})>(${cursor.map(literal).join(',')})`
          : `WHERE rowid>${literal(cursor[0])}`
        : '';
      const selection = without
        ? '*'
        : `CAST(rowid AS TEXT) AS _dd_scan_cursor,${/\bfts5\b/i.test(table.sql) ? 'rowid,' : ''}*`;
      const rows = await query(
        `SELECT ${selection}${extra} FROM ${quote(table.name)} ${predicate} ORDER BY ${order} LIMIT 100`,
      );
      const last = rows.at(-1);
      if (last) cursor = without ? keys.map((k) => last[k]) : [last._dd_scan_cursor];
      for (const row of rows) {
        delete row._dd_scan_cursor;
        const blobs = new Map();
        for (const [i, column] of blobColumns.entries()) {
          if (row['_dd_type_' + i] === 'blob') blobs.set(column, row['_dd_blob_' + i]);
          delete row['_dd_blob_' + i];
          delete row['_dd_type_' + i];
        }
        sql.push(
          `INSERT INTO ${quote(table.name)}(${Object.keys(row).map(quote).join(',')}) VALUES(${Object.entries(
            row,
          )
            .map(([key, value]) => (blobs.has(key) ? "X'" + blobs.get(key) + "'" : literal(value)))
            .join(',')});`,
        );
      }
      if (rows.length < 100) break;
    }
  }
  for (const index of await query(
    "SELECT sql FROM sqlite_schema WHERE type='index' AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ))
    sql.push(index.sql + ';');
  for (const trigger of await query(
    "SELECT sql FROM sqlite_schema WHERE type='trigger' AND sql IS NOT NULL ORDER BY name",
  ))
    sql.push(trigger.sql + ';');
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
