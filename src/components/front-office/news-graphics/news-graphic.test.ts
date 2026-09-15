import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveNewsGraphicVariant } from './news-graphic-variant';

test('maps generated story categories deterministically', () => {
  assert.equal(resolveNewsGraphicVariant('INJURY', 'Player ruled out'), 'injury');
  assert.equal(resolveNewsGraphicVariant('FRONT OFFICE', 'Club exploring a trade'), 'trade-rumor');
  assert.equal(resolveNewsGraphicVariant('TRANSACTION', 'Team signed a receiver'), 'signing');
  assert.equal(resolveNewsGraphicVariant('DRAFT', 'Rookie development update'), 'draft');
  assert.equal(resolveNewsGraphicVariant('NEWS', 'Coordinator addresses the team'), 'coach');
  assert.equal(resolveNewsGraphicVariant('NEWS', 'Important update'), 'breaking');
});
