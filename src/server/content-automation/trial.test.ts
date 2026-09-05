import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  DAILY_GENERATION_LIMIT,
  EXPIRED_MESSAGE,
  TOTAL_AI_SPEND_LIMIT_USD,
  TOTAL_GENERATION_LIMIT,
  evaluateTrialWindow,
  generationStopReason,
} from './trial';

const start = '2026-09-10T15:00:00.000Z';
const end = '2026-09-13T15:00:00.000Z';

test('accepts only an exact active 72-hour window', () => {
  assert.equal(
    evaluateTrialWindow({ startsAt: start, expiresAt: end, now: new Date('2026-09-11T00:00:00Z') })
      .active,
    true,
  );
  assert.equal(
    evaluateTrialWindow({
      startsAt: start,
      expiresAt: '2026-09-13T14:59:59Z',
      now: new Date('2026-09-11T00:00:00Z'),
    }).active,
    false,
  );
});

test('missing, invalid, and expired windows fail closed with the required message', () => {
  for (const result of [
    evaluateTrialWindow({}),
    evaluateTrialWindow({ startsAt: 'bad', expiresAt: end }),
    evaluateTrialWindow({ startsAt: start, expiresAt: end, now: new Date(end) }),
  ]) {
    assert.equal(result.active, false);
    assert.equal(result.message, EXPIRED_MESSAGE);
  }
});

test('expiration guard occurs before database, source, AI, or generation work', () => {
  const route = readFileSync('src/app/api/automation/content/route.ts', 'utf8');
  const guard = route.indexOf('if (!window.active)');
  assert.ok(guard > 0);
  assert.ok(route.indexOf('readTrialUsage', guard) > guard);
  assert.ok(route.indexOf('scheduleDueSources', guard) > guard);
  assert.ok(route.indexOf('drainJobs', guard) > guard);
});

test('hard generation and expenditure budgets stop work', () => {
  assert.equal(
    generationStopReason({
      generatedToday: DAILY_GENERATION_LIMIT,
      generatedTotal: 10,
      aiSpendTotalUsd: 0,
    }),
    'Daily generation limit reached (10)',
  );
  assert.equal(
    generationStopReason({
      generatedToday: 0,
      generatedTotal: TOTAL_GENERATION_LIMIT,
      aiSpendTotalUsd: 0,
    }),
    'Three-day generation limit reached (30)',
  );
  assert.equal(
    generationStopReason({
      generatedToday: 0,
      generatedTotal: 0,
      aiSpendTotalUsd: TOTAL_AI_SPEND_LIMIT_USD,
    }),
    'Three-day AI expenditure limit reached ($5)',
  );
});

test('workflows use isolated schedules and guard curl behind the window result', () => {
  const standard = readFileSync('.github/workflows/content-automation-standard-trial.yml', 'utf8');
  const video = readFileSync('.github/workflows/content-automation-video-trial.yml', 'utf8');
  assert.match(standard, /cron: ['"]\*\/30 \* \* \* \*['"]/);
  assert.doesNotMatch(standard, /group=video/);
  assert.match(video, /cron: ['"]0 \*\/2 \* \* \*['"]/);
  assert.doesNotMatch(video, /group=standard/);
  assert.match(standard, /if: steps\.window\.outputs\.run == 'true'/);
  assert.match(video, /if: steps\.window\.outputs\.run == 'true'/);
  assert.match(standard, /content-automation-standard-trial\.yml\/disable/);
  assert.match(video, /content-automation-video-trial\.yml\/disable/);
});
