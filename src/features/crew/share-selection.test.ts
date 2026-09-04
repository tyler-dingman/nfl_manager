import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  allRecipientsSelected,
  crewShareCta,
  resolveCrewShareAudience,
  toggleAllRecipients,
  toggleRecipient,
  type CrewShareRecipient,
} from './share-selection';

const recipients: CrewShareRecipient[] = [
  { id: 'mike', displayName: 'Mike Robertson', avatarUrl: null },
  { id: 'sarah', displayName: 'Sarah Johnson', avatarUrl: null },
  { id: 'john', displayName: 'John Kelley', avatarUrl: null },
];
const ids = recipients.map(({ id }) => id);

test('modal selection defaults to Everyone and sender is absent from server-supplied recipients', () => {
  const selected = toggleAllRecipients(ids, true);
  assert.equal(allRecipientsSelected(ids, selected), true);
  assert.equal(selected.has('sender'), false);
});
test('Everyone selects all and unchecking it selects none', () => {
  assert.deepEqual([...toggleAllRecipients(ids, true)], ids);
  assert.equal(toggleAllRecipients(ids, false).size, 0);
});
test('individual deselection clears Everyone and reselecting restores it', () => {
  let selected = toggleAllRecipients(ids, true);
  selected = toggleRecipient(selected, 'john');
  assert.equal(allRecipientsSelected(ids, selected), false);
  selected = toggleRecipient(selected, 'john');
  assert.equal(allRecipientsSelected(ids, selected), true);
});
test('CTA is disabled-state copy for zero and recipient-aware for one, two, three, or everyone', () => {
  assert.equal(crewShareCta(recipients, new Set()), 'SELECT AT LEAST ONE PERSON');
  assert.equal(crewShareCta(recipients, new Set(['mike'])), 'SEND TO MIKE →');
  assert.equal(crewShareCta(recipients, new Set(['mike', 'sarah'])), 'SEND TO MIKE + SARAH →');
  assert.equal(
    crewShareCta(
      [...recipients, { id: 'jane', displayName: 'Jane Doe', avatarUrl: null }],
      new Set(ids),
    ),
    'SEND TO 3 PEOPLE →',
  );
  assert.equal(crewShareCta(recipients, new Set(ids)), 'SEND TO CREW →');
});
test('whole membership resolves to CREW while subsets resolve to TARGETED', () => {
  assert.equal(resolveCrewShareAudience(ids, ids).visibility, 'CREW');
  assert.equal(resolveCrewShareAudience(ids, ['mike']).visibility, 'TARGETED');
});
test('removed, pending, and cross-Crew IDs are rejected because they are not active eligible members', () => {
  for (const invalidId of ['removed', 'pending', 'other-crew'])
    assert.throws(() => resolveCrewShareAudience(ids, [invalidId]), /no longer in this Crew/);
});
test('repository preserves messages, creates feed only for CREW, and notifies requested recipients only', () => {
  const source = readFileSync('src/server/crew/repository.ts', 'utf8');
  assert.match(source, /if \(visibility === 'CREW'\)[\s\S]*INSERT INTO crew_activity/);
  assert.match(source, /m\.user_id=ANY\(\$\{requestedIds\}\)/);
  assert.match(source, /input\.message\?\.slice\(0, 120\)/);
});
