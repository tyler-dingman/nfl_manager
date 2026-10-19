import test from 'node:test';
import assert from 'node:assert/strict';
import { stagingConfigs } from '../../scripts/prepare-cloudflare-staging.mjs';
const args = { databaseId: '11111111-1111-4111-8111-111111111111', subdomain: 'synthetic', root: '/tmp/synthetic' };
test('staging graph is private, isolated, cron-free, and provider-free', () => {
  const c = stagingConfigs(args);
  for (const config of Object.values(c)) {
    assert.equal(config.workers_dev, false);
    assert.equal(config.preview_urls, false);
    assert.deepEqual(config.triggers.crons, []);
    assert.match(config.name, /^down-distance-staging-/);
    assert.equal(config.routes, undefined);
    assert.equal(config.account_id, undefined);
  }
  assert.equal(c.web.services[0].service, c.api.name);
  assert.equal(c.api.services[0].service, c.password.name);
  for (const config of [c.web, c.api]) {
    assert.equal(config.vars.APP_DATA_BACKEND, 'd1');
    assert.equal(config.vars.DATABASE_URL, undefined);
    for (const [key, value] of Object.entries(config.vars))
      if (key.endsWith('_ENABLED')) assert.equal(value, 'false', key);
    assert.equal(config.d1_databases[0].database_id, args.databaseId);
    for (const bucket of config.r2_buckets) assert.match(bucket.bucket_name, /^down-distance-staging-/);
    assert.equal(config.vars.AUTH_BASE_URL, 'https://down-distance-staging-web.synthetic.workers.dev');
  }
  assert.equal(c.password.d1_databases, undefined);
  assert.equal(c.password.r2_buckets, undefined);
});
test('generator rejects placeholder IDs and unsafe URL input', () => {
  for (const databaseId of ['', 'production', '00000000-0000-0000-0000-000000000000'])
    assert.throws(() => stagingConfigs({ ...args, databaseId }));
  for (const subdomain of ['', 'prod.example.com', '../prod', 'https://prod'])
    assert.throws(() => stagingConfigs({ ...args, subdomain }));
});
