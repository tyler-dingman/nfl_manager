import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

// Local file generation only. This program never invokes Wrangler or a cloud API.
export function stagingConfigs({ databaseId, subdomain, root = process.cwd() }) {
  assert.match(databaseId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  assert.notEqual(databaseId, '00000000-0000-0000-0000-000000000000');
  assert.match(subdomain, /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/);
  const vars = {
    APP_DATA_BACKEND: 'd1',
    APP_RUNTIME: 'cloudflare',
    INFRASTRUCTURE_COST_POLICY: 'zero-cost',
    AUTH_BASE_URL: `https://down-distance-staging-web.${subdomain}.workers.dev`,
    PRELAUNCH_MODE: 'false',
    APP_PASSWORD_ENABLED: 'false',
    APP_SOCIAL_NOTIFICATIONS_ENABLED: 'false',
    APP_CONTENT_ENABLED: 'false',
    APP_BRIEFINGS_ENABLED: 'false',
    APP_ODDS_ENABLED: 'false',
    APP_ODDS_PROCESSING_ENABLED: 'false',
    APP_MAIL_ENABLED: 'false',
    APP_MAINTENANCE_ENABLED: 'false',
    APP_PUBLIC_CACHE_ENABLED: 'false',
    APP_CACHE_VERSION: 'staging-5bac5bcb',
    ACCESS_TEAM_DOMAIN: '',
    ACCESS_AUD: '',
  };
  const common = {
    compatibility_date: '2026-10-18',
    compatibility_flags: ['nodejs_compat'],
    workers_dev: false,
    preview_urls: false,
    send_metrics: false,
    triggers: { crons: [] },
    observability: { enabled: true, head_sampling_rate: 1 },
  };
  const storage = {
    vars,
    d1_databases: [
      {
        binding: 'APP_DB',
        database_name: 'down-distance-staging-app',
        database_id: databaseId,
        migrations_dir: resolve(root, 'workers/content-engine/migrations'),
      },
    ],
    r2_buckets: [
      { binding: 'APP_OBJECTS', bucket_name: 'down-distance-staging-objects' },
      { binding: 'APP_BACKUP', bucket_name: 'down-distance-staging-backups' },
    ],
  };
  return {
    password: {
      ...common,
      name: 'down-distance-staging-password',
      main: resolve(root, 'workers/password/index.ts'),
    },
    api: {
      ...common,
      ...storage,
      name: 'down-distance-staging-api',
      main: resolve(root, 'workers/api/dist/worker.mjs'),
      services: [{ binding: 'PASSWORD_SERVICE', service: 'down-distance-staging-password' }],
    },
    web: {
      ...common,
      ...storage,
      name: 'down-distance-staging-web',
      main: resolve(root, 'workers/staging/index.ts'),
      minify: true,
      assets: {
        directory: resolve(root, '.open-next/assets'),
        binding: 'ASSETS',
        run_worker_first: true,
      },
      services: [{ binding: 'API_SERVICE', service: 'down-distance-staging-api' }],
    },
  };
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const configs = stagingConfigs({
    databaseId: process.argv[2] ?? '',
    subdomain: process.argv[3] ?? '',
  });
  await mkdir('.staging', { recursive: true });
  for (const [name, config] of Object.entries(configs))
    await writeFile(`.staging/${name}.json`, JSON.stringify(config, null, 2) + '\n');
  console.log(
    'Prepared private staging configs; no remote operations performed. Public routing and password authentication remain disabled.',
  );
}
