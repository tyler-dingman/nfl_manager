import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DRAFT_PROSPECTS_2027,
  DRAFT_PROSPECTS_2027_META,
  getDraftProspectsForYear,
} from './draft-prospects';

test('active 2027 board is isolated, complete, and ordered by Tankathon rank', () => {
  assert.equal(DRAFT_PROSPECTS_2027_META.draftYear, 2027);
  assert.ok(DRAFT_PROSPECTS_2027.length >= 100);
  assert.equal(DRAFT_PROSPECTS_2027[0]?.name, 'Jeremiah Smith');
  assert.equal(DRAFT_PROSPECTS_2027[0]?.ranking, 1);
  assert.ok(DRAFT_PROSPECTS_2027.every((prospect) => prospect.draftYear === 2027));
  assert.ok(DRAFT_PROSPECTS_2027.every((prospect) => prospect.source === 'tankathon'));
  assert.equal(
    DRAFT_PROSPECTS_2027.some((prospect) => prospect.name === 'Arvell Reese'),
    false,
  );
  assert.deepEqual(
    getDraftProspectsForYear(2027).map((prospect) => prospect.ranking),
    [...DRAFT_PROSPECTS_2027]
      .map((prospect) => prospect.ranking)
      .sort((a, b) => (a ?? 999) - (b ?? 999)),
  );
});
