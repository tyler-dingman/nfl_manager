import assert from 'node:assert/strict';
import test from 'node:test';
import { selectLabFindSide, type LabSideResult } from './prop-side-research-service';

const side = (internalScore: number, sampleSize = 10, supportingGroups = 5): LabSideResult => ({
  internalScore,
  sampleSize,
  supportingGroups,
  positiveSignals: [],
  concerns: [],
});

test('selects only a strongly favored over', () =>
  assert.equal(selectLabFindSide(side(89), side(34)), 'OVER'));
test('rejects a close call', () => assert.equal(selectLabFindSide(side(82), side(74)), null));
test('selects only a strongly favored under', () =>
  assert.equal(selectLabFindSide(side(41), side(86)), 'UNDER'));
test('rejects a small sample', () =>
  assert.equal(selectLabFindSide(side(92, 3), side(20, 3)), null));
test('rejects insufficient signal agreement', () =>
  assert.equal(selectLabFindSide(side(90, 10, 2), side(30)), null));
