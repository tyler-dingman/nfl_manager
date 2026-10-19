import test from 'node:test';
import assert from 'node:assert/strict';
import { stagingConfigs } from '../../scripts/prepare-cloudflare-staging.mjs';
import { validateDeployment } from '../../scripts/staging-deployment-guard.mjs';
function fixture() {
  const c = stagingConfigs({
      databaseId: '11111111-1111-4111-8111-111111111111',
      subdomain: 'synthetic',
    }),
    id = '1'.repeat(32);
  for (const v of Object.values(c)) {
    v.account_id = id;
    if (v.vars) {
      v.vars.ACCESS_TEAM_DOMAIN = 'synthetic.cloudflareaccess.com';
      v.vars.ACCESS_AUD = 'a'.repeat(64);
    }
  }
  return [
    c,
    {
      scope: 'isolated-synthetic-staging',
      accountId: id,
      checkedUTC: new Date().toISOString(),
      workersPlan: 'free',
      r2Enabled: true,
      accessEnabled: true,
      billingReviewed: true,
      productionData: false,
      remaining: {
        workerRequests: 1000,
        d1Reads: 100000,
        d1Writes: 10000,
        r2StorageBytes: 262144000,
        r2ClassA: 10000,
        r2ClassB: 50000,
      },
      existingWorkerNames: [],
      subdomain: 'synthetic',
      access: {
        teamDomain: 'synthetic.cloudflareaccess.com',
        audience: 'a'.repeat(64),
        hostname: 'down-distance-staging-web.synthetic.workers.dev',
        policyReviewed: true,
      },
      newDatabase: {
        id: c.web.d1_databases[0].database_id,
        name: 'down-distance-staging-app',
        createdForThisStaging: true,
      },
      newBucketNames: ['down-distance-staging-objects', 'down-distance-staging-backups'],
      requiredSecrets: ['AUTH_JWT_SECRET:web+api', 'APP_MAIL_ENCRYPTION_KEY:api'],
    },
  ];
}
test('offline guard emits only private staging commands after complete operator evidence', () => {
  const [c, r] = fixture();
  const plan = validateDeployment(c, r);
  assert.match(plan, /REVIEW ONLY/);
  assert(!plan.includes('r2 bucket create'));
  assert(!plan.includes('workers paid'));
});
test('guard denies stale, paid, unprotected, mismatched and production targets', () => {
  for (const mutate of [
    (c, r) => (r.checkedUTC = '2020-01-01'),
    (c, r) => (r.r2Enabled = false),
    (c, r) => (r.accessEnabled = false),
    (c, r) => (r.workersPlan = 'paid'),
    (c, r) => (r.remaining.d1Writes = 0),
    (c, r) => (r.productionData = true),
    (c, r) => (c.web.account_id = '2'.repeat(32)),
    (c, r) => (c.api.d1_databases[0].database_id = '22222222-2222-4222-8222-222222222222'),
    (c, r) => (c.web.workers_dev = true),
    (c, r) => (c.web.assets.run_worker_first = false),
    (c, r) => (r.existingWorkerNames = [c.web.name]),
    (c, r) => (c.api.vars.DATABASE_URL = 'forbidden'),
    (c, r) => (c.web.vars.APP_MAIL_ENABLED = 'true'),
    (c, r) => (c.web.vars.ACCESS_AUD = ''),
    (c, r) => (c.api.services[0].service = 'production-api'),
  ]) {
    const [c, r] = fixture();
    mutate(c, r);
    assert.throws(() => validateDeployment(c, r));
  }
});
