import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const out = 'reports/zero-cost-phase-3';
await mkdir(out, { recursive: true });
const files = execFileSync('rg', ['--files', 'src', 'packages', 'scripts', 'workers', '.github'], {
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter(
    (f) =>
      !f.includes('node_modules/') &&
      !f.includes('/dist/') &&
      !f.includes('/measurements/') &&
      !f.includes('/reports/') &&
      !/test|fixture/i.test(f),
  );
const unresolvedSqlCalls = [];
const queries = [],
  connections = [],
  imports = [],
  functions = [];
const isSql = (text) =>
  /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+(?:TEMP\s+)?TABLE|ALTER\s+TABLE|WITH\s+\w+\s+AS)\b/i.test(
    text,
  );
for (const file of files.filter((f) => /\.(?:ts|tsx|js|mjs|cjs)$/.test(f))) {
  const text = await readFile(file, 'utf8'),
    ast = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
  const line = (node) => ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
  const name = (node) => {
    for (let p = node; p; p = p.parent) {
      if ((ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p)) && p.name)
        return p.name.getText(ast);
      if (
        ts.isVariableDeclaration(p) &&
        (ts.isArrowFunction(p.initializer ?? p) || ts.isFunctionExpression(p.initializer ?? p))
      )
        return p.name.getText(ast);
    }
    return '<module/anonymous>';
  };
  function walk(node) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      /postgres|neondatabase|^pg$/.test(node.moduleSpecifier.text)
    )
      imports.push({
        file,
        line: line(node),
        module: node.moduleSpecifier.text,
        source: node.getText(ast),
        typeOnly: Boolean(node.importClause?.isTypeOnly),
      });
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node))
      functions.push({
        file,
        line: line(node),
        name: name(node),
        calls: [...node.getText(ast).matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]),
      });
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const callee = node.expression.getText(ast);
      if (/^(postgres|neon|Pool|Client)$/.test(callee))
        connections.push({ file, line: line(node), function: name(node), callee });
    }
    const sql = ts.isTaggedTemplateExpression(node)
      ? node.template.getText(ast)
      : ts.isCallExpression(node) &&
          /\.(unsafe|query|execute|prepare|statement|rows)$/.test(node.expression.getText(ast)) &&
          node.arguments[0] &&
          (ts.isStringLiteralLike(node.arguments[0]) || ts.isTemplateExpression(node.arguments[0]))
        ? node.arguments[0].getText(ast)
        : null;
    if (
      !sql &&
      ts.isCallExpression(node) &&
      /\.(unsafe|query|execute|prepare|statement|rows)$/.test(node.expression.getText(ast))
    )
      unresolvedSqlCalls.push({
        file,
        line: line(node),
        function: name(node),
        expression: node.getText(ast),
      });
    if (sql && isSql(sql)) {
      const tables = [
        ...sql.matchAll(
          /\b(?:FROM|JOIN|UPDATE|INTO|TABLE)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?["']?([a-z_][a-z0-9_]*)/gi,
        ),
      ].map((m) => m[1].toLowerCase());
      queries.push({
        backend:
          file.startsWith('workers/') ||
          file.startsWith('packages/storage/') ||
          (tables.length && tables.every((t) => t.startsWith('app_')))
            ? 'D1'
            : 'POSTGRES_OR_MANUAL_REVIEW',
        file,
        line: line(node),
        function: name(node),
        tables: [...new Set(tables)],
        templateInterpolation: /\$\{|sql\(/.test(sql),
        sql,
      });
    }
    ts.forEachChild(node, walk);
  }
  walk(ast);
}
const declarations = [];
for (const file of files.filter((f) => /\.sql$/.test(f) && f.startsWith('db/migrations/'))) {
  const sql = await readFile(file, 'utf8');
  for (const match of sql.matchAll(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi,
  ))
    declarations.push({
      table: match[1],
      migration: file,
      line: sql.slice(0, match.index).split('\n').length,
    });
}
// rg sources above deliberately excludes tests but db/migrations is separate.
const ddlFiles = execFileSync('rg', ['--files', 'db/migrations'], { encoding: 'utf8' })
  .trim()
  .split('\n');
for (const file of ddlFiles) {
  const sql = await readFile(file, 'utf8');
  for (const match of sql.matchAll(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi,
  ))
    declarations.push({
      table: match[1],
      migration: file,
      line: sql.slice(0, match.index).split('\n').length,
    });
}
const typed = [
  'users',
  'user_credentials',
  'user_identities',
  'devices',
  'sessions',
  'auth_tokens',
  'user_profiles',
  'user_preferences',
  'user_team_follows',
  'user_saved_content',
];
const tables = [...new Set(declarations.map((d) => d.table))].sort().map((table) => ({
  table,
  status: typed.includes(table) ? 'STAGED_TYPED_SUBSET' : 'POSTGRES_REMAINING',
  declarations: declarations.filter((d) => d.table === table),
  querySites: queries
    .filter((q) => q.tables.includes(table))
    .map((q) => ({ file: q.file, line: q.line, function: q.function })),
  note: 'DDL history, not a claim that a later dropped table is still active. Raw archives are not executable adapters.',
}));
const result = {
  scope:
    'Static AST/SQL dependency inventory, all rg-visible application/job/scripts. Dynamic SQL is flagged for manual audit; caller matches are syntactic and do not prove a complete runtime call graph.',
  tables,
  unresolvedSqlCalls,
  queries,
  connections,
  imports,
  queryFunctions: functions
    .filter((f) => queries.some((q) => q.file === f.file && q.function === f.name))
    .map((f) => ({
      ...f,
      callers: functions
        .filter((c) => c.calls.includes(f.name))
        .map((c) => ({ file: c.file, line: c.line, name: c.name })),
    })),
};
await writeFile(`${out}/postgres-dependency-map.json`, JSON.stringify(result, null, 2) + '\n');
await writeFile(
  `${out}/postgres-dependency-map.md`,
  [
    '# PostgreSQL dependency inventory',
    '',
    result.scope,
    '',
    `Tables declared in migration history: ${tables.length}. SQL sites (both backends): ${queries.length}. Connection factories: ${connections.length}.`,
    '',
    '| Table | Adapter status | Query sites |',
    '|---|---|---|',
    ...tables.map((t) => `| ${t.table} | ${t.status} | ${t.querySites.length} |`),
    '',
    '## Connections',
    '',
    ...connections.map((c) => `- ${c.file}:${c.line} — ${c.function}: ${c.callee}`),
    '',
    'The JSON contains every detected SQL text, enclosing function, syntactic callers, table declaration and template-interpolation flag (values and identifiers). Tests, generated dependencies and compiled output are excluded. Each unmigrated operation remains a release blocker; staged typed tables still need full route compatibility qualification.',
  ].join('\n') + '\n',
);
console.log(
  JSON.stringify({
    tables: tables.length,
    queries: queries.length,
    connections: connections.length,
    dynamicQueries: queries.filter((q) => q.templateInterpolation).length,
  }),
);
