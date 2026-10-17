import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sealProposal, readProposalToken, substitutionPolicy } from './transfer-proposals';
test('proposal consent is bound to user, book, exact selected values and expiry', () => {
  const before = process.env.AUTH_JWT_SECRET;
  process.env.AUTH_JWT_SECRET = 'isolated-test-signing-key';
  try {
    const proposal = {
      sportsbook: 'draftkings' as const,
      matches: [],
      estimatedOdds: null,
      adjustments: 0,
    };
    const signed = sealProposal('one', proposal);
    assert.equal(readProposalToken('one', 'draftkings', signed.token).user, 'one');
    for (const token of [
      signed.token + 'x',
      'invalid',
      sealProposal('one', proposal, Date.now() - 1).token,
    ])
      assert.throws(() => readProposalToken('one', 'draftkings', token), /expired or changed/);
    assert.throws(() => readProposalToken('two', 'draftkings', signed.token));
    assert.throws(() => readProposalToken('one', 'fanduel', signed.token));
  } finally {
    if (before === undefined) delete process.env.AUTH_JWT_SECRET;
    else process.env.AUTH_JWT_SECRET = before;
  }
});
test('market-specific substitution configuration rejects invalid/unbounded differences', () => {
  const policy = substitutionPolicy({
    NODE_ENV: 'test',
    TRANSFER_MAX_DIFF_RUSHING_YARDS: '2',
    TRANSFER_MAX_DIFF_RECEPTIONS: 'NaN',
    TRANSFER_MAX_DIFF_PASSING_YARDS: 'Infinity',
    TRANSFER_MIN_SUBSTITUTE_ODDS: '-350',
  } as NodeJS.ProcessEnv);
  assert.equal(policy.differences.RUSHING_YARDS, 2);
  assert.equal(policy.differences.RECEPTIONS, 0);
  assert.equal(policy.differences.PASSING_YARDS, 0);
  assert.equal(policy.minOdds, -350);
});
