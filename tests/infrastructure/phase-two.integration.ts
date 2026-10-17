import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { authDb } from '../../src/server/auth/database';
import {
  signupWithEmail,
  issueSession,
  userFromSessionToken,
  loginWithEmail,
  resetPassword,
} from '../../src/server/auth/service';
import { createOneTimeToken } from '../../src/server/auth/repository';
import { saveContent, listSavedContent } from '../../src/server/user/content-repository';
import { getPreferences, updatePreferences } from '../../src/server/user/repository';

const url = process.env.DATABASE_URL;
if (
  !url ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
  process.env.PHASE_TWO_SYNTHETIC_DATABASE !== 'true'
)
  throw Error('Requires the disposable Phase 2 database runner');
const db = authDb();
after(async () => {
  await db.end();
});

test('accounts, sessions, preferences and saved IDs survive process restart with owner isolation', async () => {
  const a = await signupWithEmail({
    email: `a-${randomUUID()}@example.invalid`,
    password: 'synthetic-first-password',
  });
  const b = await signupWithEmail({
    email: `b-${randomUUID()}@example.invalid`,
    password: 'synthetic-other-password',
  });
  const session = await issueSession(a.user.id, {});
  await updatePreferences(a.user.id, { preferredTeamId: 'KC', reducedMotion: true });
  await saveContent(a.user.id, {
    contentType: 'STORY',
    contentId: 'saved-original-id',
    title: 'Original attribution',
    href: '/the-beat/saved-original-id',
  });
  assert.equal((await listSavedContent(b.user.id)).length, 0);
  const probe = `const { userFromSessionToken } = require('./src/server/auth/service');
const { getPreferences } = require('./src/server/user/repository');
const { listSavedContent } = require('./src/server/user/content-repository');
const { authDb } = require('./src/server/auth/database');
(async()=>{const user=await userFromSessionToken(process.env.SYNTHETIC_SESSION);
if(!user)throw Error('Missing restored session');
console.log(JSON.stringify({id:user.id,preferences:await getPreferences(user.id),saved:await listSavedContent(user.id)}));
await authDb().end();})();`;
  const result = await promisify(execFile)(process.execPath, ['--import', 'tsx', '-e', probe], {
    env: { ...process.env, SYNTHETIC_SESSION: session.refreshToken },
  });
  const restored = JSON.parse(result.stdout.trim());
  assert.equal(restored.id, a.user.id);
  assert.equal(restored.preferences.reducedMotion, true);
  assert.equal(restored.saved[0].contentId, 'saved-original-id');
  assert.equal((await getPreferences(b.user.id)).reducedMotion, false);
});

test('password reset rolls back token consumption on failure and only one concurrent reset commits', async () => {
  const email = `reset-${randomUUID()}@example.invalid`;
  const a = await signupWithEmail({ email, password: 'synthetic-first-password' });
  const session = await issueSession(a.user.id, {}),
    token = randomUUID();
  await createOneTimeToken(a.user.id, 'PASSWORD_RESET', token, 30);
  // Synthetic fault at the exact write after token consumption.
  await db.unsafe(`CREATE FUNCTION phase_two_fail_password() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic write failure'; END $$;
CREATE TRIGGER phase_two_fail BEFORE UPDATE ON user_credentials FOR EACH ROW EXECUTE FUNCTION phase_two_fail_password()`);
  try {
    await assert.rejects(resetPassword(token, 'synthetic-new-password'), /Synthetic write failure/);
  } finally {
    await db.unsafe(
      'DROP TRIGGER phase_two_fail ON user_credentials; DROP FUNCTION phase_two_fail_password()',
    );
  }
  assert.equal((await userFromSessionToken(session.refreshToken))?.id, a.user.id);
  const results = await Promise.allSettled([
    resetPassword(token, 'synthetic-new-password'),
    resetPassword(token, 'synthetic-new-password'),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(await userFromSessionToken(session.refreshToken), null);
  assert.equal((await loginWithEmail(email, 'synthetic-new-password')).id, a.user.id);
  await assert.rejects(loginWithEmail(email, 'synthetic-first-password'));
  await assert.rejects(
    resetPassword(token, 'synthetic-reused-token-password'),
    /invalid or expired/,
  );
  assert.equal((await loginWithEmail(email, 'synthetic-new-password')).id, a.user.id);
});
