import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canAcceptCrewInvite,
  canManageCrew,
  normalizeCrewInviteRecipient,
  shouldNotifyCrewShare,
} from './policy';
test('normalizes valid email and phone invitations', () => {
  assert.equal(normalizeCrewInviteRecipient('EMAIL', ' Fan@Example.COM '), 'fan@example.com');
  assert.equal(normalizeCrewInviteRecipient('SMS', '(319) 555-0184'), '+3195550184');
});
test('rejects invalid recipients', () => {
  assert.throws(() => normalizeCrewInviteRecipient('EMAIL', 'nope'));
  assert.throws(() => normalizeCrewInviteRecipient('SMS', '123'));
});
test('enforces invite expiration, ownership, and pending state', () => {
  const future = new Date(Date.now() + 60_000);
  assert.equal(canAcceptCrewInvite({ status: 'PENDING', expiresAt: future, userId: 'a' }).ok, true);
  assert.equal(
    canAcceptCrewInvite({ status: 'ACCEPTED', expiresAt: future, userId: 'a' }).ok,
    false,
  );
  assert.equal(
    canAcceptCrewInvite({ status: 'PENDING', expiresAt: new Date(0), userId: 'a' }).reason,
    'Invite has expired.',
  );
  assert.equal(
    canAcceptCrewInvite({ status: 'PENDING', expiresAt: future, inviteeUserId: 'b', userId: 'a' })
      .ok,
    false,
  );
});
test('only owners mutate Crew identity', () => {
  assert.equal(canManageCrew('OWNER'), true);
  assert.equal(canManageCrew('MEMBER'), false);
});
test('shares notify other enabled members but never the actor', () => {
  assert.equal(shouldNotifyCrewShare('a', 'b'), true);
  assert.equal(shouldNotifyCrewShare('a', 'a'), false);
  assert.equal(shouldNotifyCrewShare('a', 'b', false), false);
});
