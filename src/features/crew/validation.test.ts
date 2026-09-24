import assert from 'node:assert/strict';
import test from 'node:test';
import { crewPostSchema, crewUpdateSchema, validateCrewImage } from './validation';
import { canManageCrew } from './policy';

test('post modes require real content and exclude unsupported post types', () => {
  assert.equal(crewPostSchema.safeParse({ kind: 'TEXT', message: '  ' }).success, false);
  assert.equal(crewPostSchema.safeParse({ kind: 'TEXT', message: 'Go team!' }).success, true);
  assert.equal(crewPostSchema.safeParse({ kind: 'PHOTO', message: 'Photo' }).success, false);
  assert.equal(
    crewPostSchema.safeParse({ kind: 'PHOTO', mediaId: 'a0e9956a-ccf4-4ba5-8b9a-c737f0fe2c53' })
      .success,
    true,
  );
  for (const href of ['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd'])
    assert.equal(crewPostSchema.safeParse({ kind: 'LINK', href }).success, false);
  assert.equal(
    crewPostSchema.safeParse({ kind: 'LINK', href: 'https://example.com/story' }).success,
    true,
  );
  assert.equal(crewPostSchema.safeParse({ kind: 'POLL', message: 'Question' }).success, false);
});
test('Crew editing preserves owner-only permissions, including unsupported admin roles', () => {
  assert.equal(canManageCrew('OWNER'), true);
  assert.equal(canManageCrew('MEMBER'), false);
  assert.equal(canManageCrew('ADMIN'), false);
  assert.equal(crewUpdateSchema.safeParse({ teamAbbr: 'DEN' }).success, true);
  assert.equal(
    crewUpdateSchema.safeParse({ photoMediaId: 'https://untrusted.example/photo' }).success,
    false,
  );
});
test('uploaded image types and size are checked by content, not filename', () => {
  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.doesNotThrow(() => validateCrewImage(png, 'image/png'));
  assert.throws(() => validateCrewImage(png, 'image/jpeg'));
  assert.throws(() =>
    validateCrewImage(new TextEncoder().encode('<svg onload="alert(1)"></svg>'), 'image/png'),
  );
  assert.throws(() => validateCrewImage(new Uint8Array(2097153), 'image/png'));
});
