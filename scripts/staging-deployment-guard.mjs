import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
/** Offline planning only: no network, child processes, activation or deployment.
 * Receipt is operator-supplied evidence, not an independently verified attestation. */
export function validateDeployment(configs, receipt, now = Date.now()) {
  assert.equal(receipt.scope, 'isolated-synthetic-staging');
  assert.match(receipt.accountId, /^[a-f0-9]{32}$/);
  const age = now - Date.parse(receipt.checkedUTC);
  assert(
    Number.isFinite(age) && age >= 0 && age < 3600000,
    'Account receipt must be less than one hour old',
  );
  assert.equal(receipt.workersPlan, 'free');
  assert.equal(receipt.r2Enabled, true);
  assert.equal(receipt.accessEnabled, true);
  assert.equal(receipt.billingReviewed, true);
  assert.equal(receipt.productionData, false);
  assert(
    receipt.remaining.workerRequests >= 1000 &&
      receipt.remaining.d1Reads >= 100000 &&
      receipt.remaining.d1Writes >= 10000,
    'Insufficient daily headroom',
  );
  assert(
    receipt.remaining.r2StorageBytes >= 262144000 &&
      receipt.remaining.r2ClassA >= 10000 &&
      receipt.remaining.r2ClassB >= 50000,
    'Insufficient R2 headroom',
  );
  const names = {
    web: 'down-distance-staging-web',
    api: 'down-distance-staging-api',
    password: 'down-distance-staging-password',
  };
  assert.deepEqual(Object.keys(configs).sort(), Object.keys(names).sort());
  for (const [role, c] of Object.entries(configs)) {
    const allowed = [
      'name',
      'main',
      'compatibility_date',
      'compatibility_flags',
      'workers_dev',
      'preview_urls',
      'send_metrics',
      'triggers',
      'observability',
      'account_id',
      ...(role === 'password' ? [] : ['vars', 'd1_databases', 'r2_buckets', 'services']),
      ...(role === 'web' ? ['assets', 'minify'] : []),
    ];
    for (const key of Object.keys(c))
      assert(allowed.includes(key), 'Unsupported binding/config key: ' + key);
    assert.equal(c.name, names[role]);
    assert.equal(c.account_id, receipt.accountId, 'Pin the reviewed account in every config');
    assert.equal(c.workers_dev, false);
    assert.equal(c.preview_urls, false);
    assert(!c.routes && !c.route && !c.env && !c.dispatch_namespaces && !c.ai && !c.queues);
    assert.deepEqual(c.triggers, { crons: [] });
    assert.equal(c.compatibility_date, '2026-10-18');
    assert(
      !receipt.existingWorkerNames.includes(c.name),
      'Initial deployment must not overwrite an existing Worker',
    );
    if (role === 'password') {
      assert(!c.d1_databases && !c.r2_buckets && !c.services && !c.vars);
      continue;
    }
    const expectedVars = [
      'APP_DATA_BACKEND',
      'APP_RUNTIME',
      'INFRASTRUCTURE_COST_POLICY',
      'AUTH_BASE_URL',
      'PRELAUNCH_MODE',
      'APP_PASSWORD_ENABLED',
      'APP_SOCIAL_NOTIFICATIONS_ENABLED',
      'APP_CONTENT_ENABLED',
      'APP_BRIEFINGS_ENABLED',
      'APP_ODDS_ENABLED',
      'APP_ODDS_PROCESSING_ENABLED',
      'APP_MAIL_ENABLED',
      'APP_MAINTENANCE_ENABLED',
      'APP_PUBLIC_CACHE_ENABLED',
      'APP_CACHE_VERSION',
      'ACCESS_TEAM_DOMAIN',
      'ACCESS_AUD',
    ];
    assert.deepEqual(
      Object.keys(c.vars).sort(),
      expectedVars.sort(),
      'Unexpected environment/provider variable',
    );
    assert.equal(c.vars.APP_DATA_BACKEND, 'd1');
    for (const key of [
      'DATABASE_URL',
      'PRODUCTION_DATABASE_URL',
      'STRIPE_SECRET_KEY',
      'CONTENT_AUTOMATION_SECRET',
    ])
      assert(!(key in c.vars));
    for (const [key, value] of Object.entries(c.vars))
      if (key.endsWith('_ENABLED')) assert.equal(value, 'false', key);
    assert.equal(c.vars.AUTH_BASE_URL, `https://${names.web}.${receipt.subdomain}.workers.dev`);
    assert.equal(c.vars.ACCESS_TEAM_DOMAIN, receipt.access.teamDomain);
    assert.equal(c.vars.ACCESS_AUD, receipt.access.audience);
    assert.match(c.vars.ACCESS_TEAM_DOMAIN, /^[a-z0-9-]+\.cloudflareaccess\.com$/);
    assert.match(c.vars.ACCESS_AUD, /^[a-f0-9]{64}$/);
    assert.equal(receipt.access.hostname, new URL(c.vars.AUTH_BASE_URL).hostname);
    assert.equal(receipt.access.policyReviewed, true);
    assert.equal(c.d1_databases.length, 1);
    const db = c.d1_databases[0];
    assert.equal(db.binding, 'APP_DB');
    assert.equal(db.database_name, 'down-distance-staging-app');
    assert.equal(db.database_id, receipt.newDatabase.id);
    assert.equal(receipt.newDatabase.name, db.database_name);
    assert.equal(receipt.newDatabase.createdForThisStaging, true);
    assert.match(db.database_id, /^[a-f0-9-]{36}$/);
    assert.notEqual(db.database_id, '00000000-0000-0000-0000-000000000000');
    assert.deepEqual(c.r2_buckets, [
      { binding: 'APP_OBJECTS', bucket_name: 'down-distance-staging-objects' },
      { binding: 'APP_BACKUP', bucket_name: 'down-distance-staging-backups' },
    ]);
    assert.deepEqual(receipt.newBucketNames, [
      'down-distance-staging-objects',
      'down-distance-staging-backups',
    ]);
    assert.deepEqual(c.services, [
      role === 'web'
        ? { binding: 'API_SERVICE', service: names.api }
        : { binding: 'PASSWORD_SERVICE', service: names.password },
    ]);
  }
  assert.match(configs.web.main, /workers\/staging\/index\.ts$/);
  assert.equal(configs.web.assets.run_worker_first, true);
  assert.deepEqual(receipt.requiredSecrets, [
    'AUTH_JWT_SECRET:web+api',
    'APP_MAIL_ENCRYPTION_KEY:api',
  ]);
  return (
    [
      '# REVIEW ONLY: no commands were executed; first deployment remains private.',
      `export CLOUDFLARE_ACCOUNT_ID=${receipt.accountId}`,
      'node node_modules/wrangler/bin/wrangler.js d1 migrations apply APP_DB --remote --config .staging/api.json',
      ...['password', 'api', 'web'].map(
        (role) =>
          `node node_modules/wrangler/bin/wrangler.js deploy --config .staging/${role}.json`,
      ),
      'node node_modules/wrangler/bin/wrangler.js secret put AUTH_JWT_SECRET --config .staging/api.json',
      'node node_modules/wrangler/bin/wrangler.js secret put APP_MAIL_ENCRYPTION_KEY --config .staging/api.json',
      'node node_modules/wrangler/bin/wrangler.js secret put AUTH_JWT_SECRET --config .staging/web.json',
      '# STOP: verify secrets, Access denial, platform CPU and health before separately enabling web routing.',
    ].join('\n') + '\n'
  );
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const receipt = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const configs = Object.fromEntries(
    await Promise.all(
      ['web', 'api', 'password'].map(async (role) => [
        role,
        JSON.parse(await readFile(`.staging/${role}.json`, 'utf8')),
      ]),
    ),
  );
  const commands = validateDeployment(configs, receipt);
  await writeFile('.staging/reviewed-commands.sh', commands, { mode: 0o600 });
  console.log('Offline guard passed; review-only commands saved. No commands executed.');
}
