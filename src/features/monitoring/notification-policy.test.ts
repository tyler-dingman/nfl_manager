import assert from 'node:assert/strict';
import test from 'node:test';

import { MONITORING_THRESHOLDS } from './config';
import { evaluateObserverNotification } from './notification-policy';

const decide = (changes: Partial<Parameters<typeof evaluateObserverNotification>[0]> = {}) =>
  evaluateObserverNotification({
    score: 92,
    tier: 1,
    official: false,
    confirmedTransaction: false,
    materialUpdate: false,
    alreadyNotified: false,
    thresholds: MONITORING_THRESHOLDS,
    ...changes,
  });

test('tier 3 cannot establish a push by itself', () => {
  assert.equal(decide({ tier: 3, score: 100 }).decision, 'INDEX_ONLY');
});

test('tier 2 becomes a candidate rather than an independent breaking push', () => {
  assert.equal(decide({ tier: 2 }).decision, 'CANDIDATE');
});

test('official high impact events can push', () => {
  assert.equal(decide({ official: true }).decision, 'PUSH');
});

test('repeat event without a material update is suppressed', () => {
  assert.equal(decide({ alreadyNotified: true }).decision, 'SUPPRESSED');
});
