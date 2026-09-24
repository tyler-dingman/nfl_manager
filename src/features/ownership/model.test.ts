import test from 'node:test';
import assert from 'node:assert/strict';
import { initialOwnership, ownershipReducer, ownershipMetrics, reportCard } from './model';
test('projects charge capital once and affect connected metrics only after completion', () => {
  const initial = initialOwnership(2026);
  const approved = ownershipReducer(initial, { type: 'approve', id: 'medical' }, 2026, 1);
  assert.equal(approved.capital, 168);
  assert.strictEqual(
    ownershipReducer(approved, { type: 'approve', id: 'medical' }, 2026, 2),
    approved,
  );
  assert.equal(ownershipMetrics(approved, 2026).recovery, 65);
  const completed = ownershipReducer(approved, { type: 'advance' }, 2026, 11);
  assert.equal(ownershipMetrics(completed, 2026).recovery, 71);
  assert(
    reportCard(completed, 2026).find((g) => g.name === 'Training Room')!.score >
      reportCard(initial, 2026).find((g) => g.name === 'Training Room')!.score,
  );
  assert.strictEqual(ownershipReducer(completed, { type: 'advance' }, 2026, 12), completed);
  assert.equal(completed.history.length, 2);
});
test('capital limits, ticket tradeoffs and partnership duplication are enforced', () => {
  const initial = initialOwnership(2026);
  assert.strictEqual(
    ownershipReducer(initial, { type: 'approve', id: 'new-stadium' }, 2026, 1),
    initial,
  );
  const tickets = ownershipReducer(initial, { type: 'ticket', price: 150 }, 2026, 1);
  assert(ownershipMetrics(tickets, 2026).revenue > ownershipMetrics(initial, 2026).revenue);
  assert(ownershipMetrics(tickets, 2026).sentiment < ownershipMetrics(initial, 2026).sentiment);
  assert.strictEqual(ownershipReducer(initial, { type: 'ticket', price: NaN }, 2026, 1), initial);
  const signed = ownershipReducer(initial, { type: 'partner', id: 'naming' }, 2026, 1);
  assert.equal(signed.capital, 204);
  assert.strictEqual(ownershipReducer(signed, { type: 'partner', id: 'naming' }, 2026, 1), signed);
  assert.equal(ownershipMetrics(signed, 2034).activePartners.length, 0);
});
test('annual income funds capital projects without double-crediting the same season', () => {
  const state = initialOwnership(2026);
  const advanced = ownershipReducer(state, { type: 'advance' }, 2027, 1);
  assert.equal(advanced.capital, 186 + 116);
  assert.strictEqual(ownershipReducer(advanced, { type: 'advance' }, 2027, 2), advanced);
  assert.equal(advanced.history[0].id, 'financial-2026');
});
