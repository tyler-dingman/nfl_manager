import { loadEnvConfig } from '@next/env';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

async function main() {
  loadEnvConfig(process.cwd());
  const baseURL = process.env.CREW_AUDIT_URL ?? 'http://localhost:3100';
  if (
    !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname) ||
    !['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL!).hostname)
  )
    throw new Error('Crew audit only runs against a local app and local database.');
  const { authDb } = await import('../src/server/auth/database');
  const { createSession } = await import('../src/server/auth/repository');
  const repo = await import('../src/server/crew/repository');
  const sql = authDb();
  await sql.begin(async (tx) => {
    const migration = await readFile('db/migrations/041_crew_feed_and_photos.sql', 'utf8');
    await tx.unsafe(migration.replace(/^BEGIN;|^COMMIT;/gm, ''));
  });
  const owner = randomUUID(),
    member = randomUUID(),
    outsider = randomUUID();
  const users = [owner, member, outsider];
  const tokens = users.map(() => randomBytes(32).toString('hex'));
  const browser = await chromium.launch();
  const out = '/tmp/crew-redesign-audit';
  await mkdir(out, { recursive: true });
  try {
    for (let i = 0; i < users.length; i++) {
      await sql`INSERT INTO users(id,display_name,primary_email) VALUES(${users[i]},${['Jordan Morgan', 'Alex Rivera', 'Sam Carter'][i]},${`crew-audit-${users[i]}@example.test`})`;
      await sql`INSERT INTO user_profiles(user_id) VALUES(${users[i]})`;
      await createSession({ userId: users[i], token: tokens[i] });
    }
    const created = await repo.createCrew(owner, {
      name: 'Jordan’s Kansas City Chiefs Crew',
      teamAbbr: 'KC',
    });
    await sql`INSERT INTO crew_members(id,crew_id,user_id,role,status,joined_at) VALUES(${randomUUID()},${created.id},${member},'MEMBER','ACTIVE',now())`;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await context.addCookies([{ name: 'dd_session', value: tokens[0], url: baseURL }]);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${baseURL}/crew`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Jordan’s Kansas City Chiefs Crew' }).waitFor();
    await page.screenshot({ path: `${out}/desktop-empty.png`, fullPage: true });
    assert.equal(await page.getByRole('button', { name: 'Upload Photo', exact: true }).count(), 1);
    assert.equal(await page.getByRole('button', { name: 'Poll', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Post', exact: true }).isEnabled(), false);
    // A generated color-block fixture is test data, never product artwork.
    const png = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 800;
      c.height = 600;
      const x = c.getContext('2d')!;
      x.fillStyle = '#12334b';
      x.fillRect(0, 0, 400, 600);
      x.fillStyle = '#ed0035';
      x.fillRect(400, 0, 400, 600);
      return c.toDataURL('image/png').split(',')[1];
    });
    const fixture = {
      name: 'crew-fixture.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png, 'base64'),
    };
    await page.getByLabel('Upload Crew photo', { exact: true }).setInputFiles(fixture);
    await page.getByRole('dialog', { name: 'Edit Crew photo', exact: true }).waitFor();
    await page.getByLabel('Zoom', { exact: true }).fill('1.5');
    await page.getByRole('button', { name: 'Save photo', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Edit Crew photo', exact: true })
      .waitFor({ state: 'hidden' });
    await page.getByAltText('Crew photo', { exact: true }).waitFor();
    const saved = await repo.getCrewForUser(owner);
    assert.ok(saved?.photoUrl);
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByAltText('Crew photo', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Edit Crew photo', exact: true }).click();
    await page.getByRole('button', { name: 'Edit Photo', exact: true }).click();
    await page.getByLabel('Horizontal position', { exact: true }).fill('80');
    await page.getByRole('button', { name: 'Save photo', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Edit Crew photo', exact: true })
      .waitFor({ state: 'hidden' });
    assert.notEqual((await repo.getCrewForUser(owner))?.photoUrl, saved?.photoUrl);
    await page.getByRole('button', { name: 'Edit Crew photo', exact: true }).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload Photo', exact: true }).click();
    await (await chooser).setFiles(fixture);
    await page.getByRole('button', { name: 'Save photo', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Edit Crew photo', exact: true })
      .waitFor({ state: 'hidden' });
    await page
      .getByLabel('Share a message with your crew', { exact: true })
      .fill('Ready for game day.');
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await page.getByText('Ready for game day.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Link', exact: true }).click();
    await page.getByLabel('Link URL', { exact: true }).fill('javascript:alert(1)');
    assert.equal(await page.getByRole('button', { name: 'Post', exact: true }).isEnabled(), false);
    await page.getByLabel('Link URL', { exact: true }).fill('https://example.com/football');
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await page.getByRole('link', { name: 'https://example.com/football', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Photo', exact: true }).click();
    await page.getByLabel('Attach post photo', { exact: true }).setInputFiles(fixture);
    await page.getByAltText('Attached post photo').waitFor();
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await page.getByAltText('Photo shared with the Crew').waitFor();
    await page.getByRole('button', { name: 'Comments', exact: true }).first().click();
    await page.getByLabel('Write a comment').fill('See you at kickoff.');
    await page.getByRole('button', { name: 'Reply', exact: true }).click();
    await page.getByText('See you at kickoff.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'React FIRE', exact: true }).first().click();
    await page.getByRole('button', { name: 'Invite Friends', exact: true }).first().click();
    await page.getByRole('button', { name: 'SHARE LINK', exact: true }).click();
    await page.getByRole('button', { name: 'Create invite', exact: true }).click();
    await page.getByLabel('Invite link', { exact: true }).waitFor();
    assert.match(
      await page.getByLabel('Invite link', { exact: true }).inputValue(),
      /\/crew\/invite\//,
    );
    await page.getByRole('button', { name: 'Close Invite Friends', exact: true }).click();
    await page.getByRole('tab', { name: 'MEMBERS (2)', exact: true }).click();
    await page.getByText('Lifetime', { exact: false }).first().waitFor();
    await page.getByRole('tab', { name: 'LEADERBOARD', exact: true }).click();
    await page
      .getByRole('heading', { name: 'THIS WEEK’S CREW LEADERBOARD', exact: true })
      .waitFor();
    await page.getByRole('tab', { name: 'SETTINGS', exact: true }).click();
    await page.getByLabel('Crew name', { exact: true }).fill('Jordan’s Game Day Crew');
    await page.getByRole('button', { name: 'Save settings', exact: true }).click();
    await page.getByText('Crew settings saved.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Leave Crew', exact: true }).click();
    await page.getByRole('dialog', { name: 'Crew ownership', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Got it', exact: true }).click();
    await page.getByRole('tab', { name: 'FEED', exact: true }).click();
    await page.getByRole('button', { name: 'Manage Settings', exact: true }).click();
    await page.getByRole('heading', { name: 'CREW SETTINGS', exact: true }).waitFor();
    await page.getByRole('tab', { name: 'FEED', exact: true }).click();
    await page.getByRole('button', { name: 'View Leaderboard', exact: true }).last().click();
    await page
      .getByRole('heading', { name: 'THIS WEEK’S CREW LEADERBOARD', exact: true })
      .waitFor();
    await page.getByRole('tab', { name: 'FEED', exact: true }).click();
    await page.screenshot({ path: `${out}/desktop.png`, fullPage: true });
    for (const width of [320, 393, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        `Overflow at ${width}`,
      );
      if (width === 393 || width === 768)
        await page.screenshot({ path: `${out}/${width}.png`, fullPage: true });
    }
    const post = (await repo.getCrewForUser(owner))!.activity.find(
      (a: any) => a.type === 'POST_TEXT',
    );
    await assert.rejects(() => repo.updateCrew(member, { name: 'Unauthorized' }));
    await assert.rejects(() => repo.leaveCrew(owner));
    await assert.rejects(() => repo.deleteCrewPost(member, post.id));
    await assert.rejects(() => repo.commentOnCrewActivity(outsider, post.id, 'Not allowed'));
    await assert.rejects(() => repo.removeCrewMember(member, owner));
    const memberContext = await browser.newContext({ viewport: { width: 393, height: 852 } });
    await memberContext.addCookies([{ name: 'dd_session', value: tokens[1], url: baseURL }]);
    const memberPage = await memberContext.newPage();
    await memberPage.goto(`${baseURL}/crew`, { waitUntil: 'networkidle' });
    assert.equal(
      await memberPage.getByRole('button', { name: 'Edit Crew photo', exact: true }).count(),
      0,
    );
    await memberPage.getByRole('tab', { name: 'SETTINGS', exact: true }).click();
    assert.equal(await memberPage.getByLabel('Crew name', { exact: true }).count(), 0);
    await memberPage.getByRole('button', { name: 'Leave Crew', exact: true }).click();
    await memberPage.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.ok(await repo.getCrewForUser(member));
    await memberPage.getByRole('button', { name: 'Leave Crew', exact: true }).click();
    await memberPage.getByRole('button', { name: 'Confirm', exact: true }).click();
    await memberPage.getByRole('button', { name: 'Create my Crew', exact: true }).waitFor();
    assert.equal(await repo.getCrewForUser(member), null);
    const mediaResponse = await memberContext.request.get(baseURL + saved!.photoUrl);
    assert.equal(mediaResponse.status(), 404);
    // Confirm owner moderation works, in addition to the rejected member actions.
    await sql`INSERT INTO crew_members(id,crew_id,user_id,role,status,joined_at) VALUES(${randomUUID()},${created.id},${member},'MEMBER','ACTIVE',now()) ON CONFLICT(crew_id,user_id) DO UPDATE SET status='ACTIVE'`;
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: 'MEMBERS (2)', exact: true }).click();
    await page.getByLabel('Manage Alex Rivera', { exact: true }).click();
    await page.getByRole('button', { name: 'Remove member', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await page.getByRole('tab', { name: 'MEMBERS (1)', exact: true }).waitFor();
    assert.equal(await repo.getCrewForUser(member), null);
    await page.getByRole('tab', { name: 'FEED', exact: true }).click();
    await page.getByLabel('Post options', { exact: true }).first().click();
    await page.getByRole('button', { name: 'Delete post', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await page.getByAltText('Photo shared with the Crew').waitFor({ state: 'hidden' });
    assert.deepEqual(errors, []);
    console.log(
      'Crew audit passed: persisted upload/crop/replacement, text/photo/link posts, comments/reactions, share-link invites, tabs/settings/quick actions, owner/member protections and five responsive widths.',
    );
  } finally {
    await sql`DELETE FROM users WHERE id=ANY(${users})`;
    await browser.close();
    await sql.end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
