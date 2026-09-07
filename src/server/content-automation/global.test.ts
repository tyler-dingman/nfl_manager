import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  DEFAULT_GLOBAL_GENERATION_LIMIT_PER_DAY,
  DEFAULT_GLOBAL_GENERATION_LIMIT_PER_RUN,
  globalAutomationConfig,
  globalGenerationStopReason,
} from './global';

test('global automation fails closed and uses bounded defaults', () => {
  assert.deepEqual(globalAutomationConfig({}), {
    enabled: false,
    maxGeneratedPerRun: DEFAULT_GLOBAL_GENERATION_LIMIT_PER_RUN,
    maxGeneratedPerDay: DEFAULT_GLOBAL_GENERATION_LIMIT_PER_DAY,
  });
  assert.equal(
    globalGenerationStopReason({
      enabled: false,
      generatedToday: 0,
      maxGeneratedPerDay: 320,
    }),
    'Global content automation is disabled',
  );
});

test('invalid limits cannot remove global generation bounds', () => {
  assert.deepEqual(
    globalAutomationConfig({
      CONTENT_AUTOMATION_GLOBAL_ENABLED: 'true',
      CONTENT_AUTOMATION_MAX_GENERATED_PER_RUN: '0',
      CONTENT_AUTOMATION_MAX_GENERATED_PER_DAY: 'not-a-number',
    }),
    {
      enabled: true,
      maxGeneratedPerRun: DEFAULT_GLOBAL_GENERATION_LIMIT_PER_RUN,
      maxGeneratedPerDay: DEFAULT_GLOBAL_GENERATION_LIMIT_PER_DAY,
    },
  );
});

test('daily limit stops global processing', () => {
  assert.equal(
    globalGenerationStopReason({
      enabled: true,
      generatedToday: 320,
      maxGeneratedPerDay: 320,
    }),
    'Global daily generation limit reached (320)',
  );
});

test('global endpoint checks authorization and kill switch before database and sources', () => {
  const route = readFileSync('src/app/api/automation/content/global/route.ts', 'utf8');
  const authorization = route.indexOf("request.headers.get('authorization')");
  const config = route.indexOf('globalAutomationConfig()');
  const disabled = route.indexOf('if (disabled)');
  const database = route.indexOf('readGlobalGeneratedToday()');
  const sources = route.indexOf('syncAllMonitoringRegistries()');
  assert.ok(authorization > 0);
  assert.ok(config > authorization);
  assert.ok(disabled > config);
  assert.ok(database > disabled);
  assert.ok(sources > database);
  assert.match(route, /scheduleDueSources\(new Date\(\)\)/);
  assert.match(route, /new GroundedDeterministicStorySynthesizer\(\)/);
  assert.match(route, /aiSpendUsd: 0/);
});

test('Cloudflare Worker authenticates one global call on the five-minute cron', () => {
  const worker = readFileSync('workers/content-scheduler/src/index.js', 'utf8');
  const config = readFileSync('workers/content-scheduler/wrangler.toml', 'utf8');
  assert.match(worker, /\/api\/automation\/content\/global/);
  assert.match(worker, /Authorization: `Bearer \$\{env\.DND_AUTOMATION_SECRET\}`/);
  assert.match(worker, /async scheduled/);
  assert.match(config, /^\s*crons\s*=\s*\["\*\/5 \* \* \* \*"\]/m);
});

test('migration runner includes the permanent automation ledger', () => {
  const runner = readFileSync('scripts/migrate-auth.ts', 'utf8');
  const migration = readFileSync('db/migrations/028_content_automation_global.sql', 'utf8');
  assert.match(runner, /028_content_automation_global\.sql/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS content_automation_runs/);
});
