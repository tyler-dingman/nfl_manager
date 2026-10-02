const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const out = path.resolve('reports/huddle/previews');
fs.mkdirSync(out, { recursive: true });
require('@next/env').loadEnvConfig(process.cwd());
const crypto = require('node:crypto');
const dbUrl = process.env.DATABASE_URL;
if (!['localhost', '127.0.0.1'].includes(new URL(dbUrl).hostname))
  throw Error('Local database required');
const sql = require('postgres')(dbUrl, { ssl: false, max: 1 }),
  uid = crypto.randomUUID(),
  token = crypto.randomBytes(32).toString('hex');
const now = new Date().toISOString();
const game = {
  id: 'demo',
  home: 'DAL',
  away: 'PHI',
  homeScore: 10,
  awayScore: 17,
  status: 'live',
  clock: '6:24',
  quarter: 3,
  kickoff: now,
  possession: 'PHI',
  down: '3rd & 4',
  location: 'PHI 42',
  ball: 42,
  direction: 1,
  driveId: 'drive',
  driveSummary: '6 plays, 48 yards · 2:31 elapsed',
  updatedAt: now,
  plays: [
    {
      id: 'p',
      sequence: 1,
      quarter: 3,
      clock: '6:24',
      down: '3rd & 4',
      location: 'PHI 42',
      text: 'Pass complete for 12 yards. First down.',
      yards: 12,
      scoring: false,
      key: true,
      driveId: 'drive',
      at: now,
    },
  ],
};
const snapshot = {
  messages: Array.from({ length: 30 }, (_, i) => ({
    id: `m${i}`,
    userId: `u${i}`,
    name: ['PhillyMike', 'EagleFaithful', 'BirdsFilmRoom'][i % 3],
    avatar: null,
    body: [
      'That’s the connection we needed.',
      'The line is settling in.',
      'Looking confident now.',
    ][i % 3],
    at: now,
    playId: 'p',
    likes: Math.max(0, 30 - i),
    removed: false,
  })),
  polls: [
    {
      id: 'poll',
      question: 'What changed the game?',
      options: ['Offense', 'Defense'],
      counts: [12, 8],
      closed: false,
    },
  ],
  game,
  participants: 24,
  cursor: now,
  before: null,
  hiddenUsers: [],
  voted: {},
  liked: [],
  canModerate: false,
};
let browser;
(async () => {
  await sql`INSERT INTO users(id,display_name)VALUES(${uid},'Huddle preview test')`;
  await sql`INSERT INTO sessions(id,user_id,refresh_token_hash,token_family_id,expires_at)VALUES(${crypto.randomUUID()},${uid},${crypto.createHash('sha256').update(token).digest('hex')},${crypto.randomUUID()},now()+interval '1 hour')`;
  browser = await chromium.launch();
  for (const [label, width, height] of [
    ['desktop', 1440, 1000],
    ['mobile', 393, 852],
    ['tablet', 900, 1000],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const expiry = String(Date.now() + 3600000),
      preview =
        expiry +
        '.' +
        crypto
          .createHmac(
            'sha256',
            process.env.PRELAUNCH_SESSION_SECRET || process.env.PRELAUNCH_PASSWORD || '',
          )
          .update(expiry)
          .digest('base64url');
    await page.context().addCookies([
      { name: 'dd_session', value: token, url: 'http://localhost:3000' },
      { name: 'dnd_preview_access', value: preview, url: 'http://localhost:3000' },
    ]);
    let state = structuredClone(snapshot);
    await page.route('**/api/huddle?**', async (r) => {
      if (r.request().method() === 'POST') {
        const b = r.request().postDataJSON();
        if (b.action === 'message')
          state.messages.push({ ...state.messages[0], id: 'sent', body: b.body });
        if (b.action === 'vote') state.voted[b.id] = b.choice;
        return r.fulfill({ json: { ok: true } });
      }
      return r.fulfill({ json: state });
    });
    await page.goto('http://localhost:3000/huddle?team=PHI');
    console.log('Preview page', label, page.url());
    await page.screenshot({ path: path.join(out, `${label}-loaded.png`) });
    await page.getByRole('heading', { name: 'THE HUDDLE', exact: true }).waitFor();
    await page
      .getByText('Pass complete for 12 yards. First down.', { exact: true })
      .first()
      .waitFor();
    await page.screenshot({ path: path.join(out, `${label}-live.png`), fullPage: true });
    await page.getByRole('button', { name: 'Polls', exact: true }).click();
    await page.getByRole('button', { name: /Offense/ }).click();
    if (!state.voted.poll && state.voted.poll !== 0) throw Error('Vote not submitted');
    await page.getByRole('button', { name: 'Chat', exact: true }).click();
    await page.getByRole('textbox', { name: 'Say something' }).fill('A fixture-only message');
    await page.getByRole('button', { name: 'Send message' }).click();
    await page.getByText('A fixture-only message', { exact: true }).waitFor();
    if (label === 'desktop') {
      await page.waitForTimeout(500);
      await page.locator('[class*="chat"]').evaluate((el) => {
        el.scrollTop = 0;
        el.dispatchEvent(new Event('scroll', { bubbles: true }));
      });
      state.messages.push({
        ...state.messages[0],
        id: 'new-comment',
        body: 'New fixture comment',
        at: new Date().toISOString(),
      });
      state.game.plays.push({
        ...state.game.plays[0],
        id: 'new-play',
        sequence: 2,
        text: 'Another sample first down.',
      });
      try {
        await page
          .getByRole('button', { name: /NEW PLAYS.*NEW COMMENTS/ })
          .waitFor({ timeout: 25000 });
      } catch (e) {
        console.log(
          await page
            .locator('[class*=chat]')
            .evaluate((el) => ({
              height: el.clientHeight,
              scrollHeight: el.scrollHeight,
              top: el.scrollTop,
              text: el.textContent.slice(-400),
            })),
        );
        console.log(await page.getByRole('button').allTextContents());
        throw e;
      }
      await page.getByRole('button', { name: /NEW PLAYS.*NEW COMMENTS/ }).click();
    }
    await page.getByRole('button', { name: 'Play-by-Play', exact: true }).click();
    await page.screenshot({ path: path.join(out, `${label}-plays.png`), fullPage: true });
    for (const status of ['pregame', 'halftime', 'final']) {
      state.game.status = status;
      await page.reload();
      await page.getByText(status.toUpperCase(), { exact: true }).waitFor();
    }
    state.game = null;
    await page.reload();
    await page.getByText('Your team. Your conversation.', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(out, `${label}-team.png`), fullPage: true });
    await page.close();
  }
  await browser.close();
  console.log(
    'PASS desktop/mobile/tablet: live, PBP, polls, send, pregame, halftime, final, non-game. Isolated fixtures only.',
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    await sql`DELETE FROM users WHERE id=${uid}`;
    await sql.end();
  });
