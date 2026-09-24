import { loadEnvConfig } from '@next/env';
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

async function main() {
  loadEnvConfig(process.cwd());
  const baseURL = 'http://localhost:3100';
  if (!['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL!).hostname))
    throw new Error('Local database required');
  const { authDb } = await import('../src/server/auth/database');
  const { createSession } = await import('../src/server/auth/repository');
  const repo = await import('../src/server/trivia/game-repository');
  const sql = authDb();
  const users = [randomUUID(), randomUUID()];
  const token = randomBytes(32).toString('hex');
  const browser = await chromium.launch();
  let gameId: string | undefined;
  try {
    for (const [i, id] of users.entries()) {
      await sql`INSERT INTO users(id,display_name,primary_email) VALUES(${id},${i ? 'Alex Rivera' : 'Jordan Morgan'},${`trivia-audit-${id}@example.test`})`;
      await sql`INSERT INTO user_profiles(user_id) VALUES(${id})`;
    }
    await createSession({ userId: users[0], token });
    gameId = (await repo.createTriviaGame(users[0], 'KC')).gameId;
    await sql`INSERT INTO trivia_game_participants(game_id,user_id) VALUES(${gameId},${users[1]})`;
    await sql`UPDATE trivia_games SET mode='GROUP' WHERE id=${gameId}`;
    const questions =
      await sql`SELECT q.correct_answer AS answer,gq.position FROM trivia_game_questions gq JOIN trivia_questions q ON q.id=gq.question_id WHERE gq.game_id=${gameId} ORDER BY position`;
    await sql`UPDATE trivia_game_questions SET presented_at=now()+interval '5 minutes' WHERE game_id=${gameId} AND position=1`;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await context.addCookies([{ name: 'dd_session', value: token, url: baseURL }]);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', async (r) => {
      if (r.url().includes('/api/trivia/games/') && !r.ok())
        console.log(r.status(), await r.text().catch(() => 'closed'));
    });
    console.log('Opening game');
    await page.goto(`${baseURL}/trivia?team=KC&game=${gameId}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /^A / }).waitFor();
    console.log('Checking live endpoint');
    const liveResponse = await context.request.get(`${baseURL}/api/trivia/games/${gameId}?live=1`);
    assert.equal(liveResponse.ok(), true, await liveResponse.text());
    const out = '/tmp/trivia-redesign-audit';
    await mkdir(out, { recursive: true });
    console.log('Checking widths');
    for (const width of [1440, 1280, 1024, 768, 430, 390, 375]) {
      await page.setViewportSize({ width, height: 1100 });
      await page.screenshot({ path: `${out}/${width}.png`, fullPage: true });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        `overflow at ${width}`,
      );
      const boxes = await page.getByRole('button', { name: /^[ABCD] / }).evaluateAll((els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect();
          return { x: r.x, y: r.y, height: r.height };
        }),
      );
      assert.ok(boxes.every((b) => b.height >= 44));
      if (width <= 430) assert.equal(boxes[0].x, boxes[1].x);
    }
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.route('**/api/trivia/games/*?live=1', (route) => route.abort());
    await page.getByText(/Reconnecting to live standings/).waitFor();
    await page.unroute('**/api/trivia/games/*?live=1');
    await page.getByText(/Reconnecting to live standings/).waitFor({ state: 'hidden' });
    await sql`UPDATE trivia_game_questions SET presented_at=now() WHERE game_id=${gameId} AND position=1`;
    await sql`UPDATE trivia_games SET timer_seconds=6 WHERE id=${gameId}`;
    await sql`UPDATE trivia_game_questions SET presented_at=now()+interval '3 seconds' WHERE game_id=${gameId} AND position=1`;
    await page.reload({ waitUntil: 'networkidle' });
    for (let index = 0; index < 10; index++) {
      console.log('Question', index + 1);
      await page.getByText(`Question ${index + 1} of 10`, { exact: true }).waitFor();
      await sql`UPDATE trivia_game_questions SET presented_at=now() WHERE game_id=${gameId} AND position=${index + 1}`;
      await repo.answerTriviaGameQuestion(users[1], gameId, questions[index].answer);
      const answer =
        index === 1 ? (questions[index].answer === 'A' ? 'B' : 'A') : questions[index].answer;
      if (index === 2) {
        await sql`UPDATE trivia_game_questions SET presented_at=now()-interval '25 seconds' WHERE game_id=${gameId} AND position=${index + 1}`;
        await page.reload({ waitUntil: 'networkidle' });
      } else {
        const submitted = page.waitForResponse(
          (r) => r.url().endsWith('/answer') && r.request().method() === 'POST',
        );
        await page.getByRole('button', { name: new RegExp(`^${answer} `) }).click();
        assert.equal((await submitted).ok(), true);
      }
      // Group reveal waits for the shared question deadline; advance only the fixture clock.
      if (index !== 2)
        await sql`UPDATE trivia_game_questions SET presented_at=now()-interval '25 seconds' WHERE game_id=${gameId} AND position=${index + 1}`;
      const live = await repo.getTriviaLiveState(users[0], gameId);
      assert.equal(live.activity.length > 0, true);
      await page
        .getByText(index === 2 ? /Time expired\./ : index === 1 ? /^Incorrect\./ : /^Correct! \+10/)
        .waitFor({ timeout: 35000 });
      assert.equal(await page.locator('[data-state="correct"]').count(), 1);
      const expectedScore = Math.max(
        0,
        (index + 1 - (index >= 1 ? 1 : 0) - (index >= 2 ? 1 : 0)) * 10,
      );
      await page
        .locator('li[data-current=true]')
        .getByText(String(expectedScore), { exact: true })
        .waitFor();
      await page
        .getByText(`Q${index + 1} ·`, { exact: false })
        .first()
        .waitFor();
      if (index === 3)
        await page.screenshot({ path: `${out}/active-feedback.png`, fullPage: true });
      if (index === 1) assert.equal(await page.locator('[data-state="incorrect"]').count(), 1);
    }
    await page.getByRole('heading', { name: 'Alex Rivera wins' }).waitFor({ timeout: 15000 });
    const final = await repo.getTriviaLiveState(users[0], gameId);
    assert.equal(final.standings[0].userId, users[1]);
    assert.equal(final.standings[1].score, 80);
    await page.screenshot({ path: `${out}/complete.png`, fullPage: true });
    assert.equal(await page.getByText('Trending Props', { exact: true }).count(), 0);
    assert.equal(await page.getByText('End zone', { exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    await page.getByRole('button', { name: 'Play with Buddies', exact: true }).first().click();
    await page.getByRole('heading', { name: 'Play with buddies', exact: true }).waitFor();
    await page.goto(`${baseURL}/trivia?team=KC&game=${gameId}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Rematch', exact: true }).click();
    await page.waitForURL(/room=/);
    await page.goto(`${baseURL}/trivia?team=KC&game=${gameId}`, { waitUntil: 'networkidle' });
    await page.getByLabel('Select trivia team').selectOption('DEN');
    await page.waitForURL(/team=DEN/);
    await page.getByRole('button', { name: /Play Solo/ }).click();
    await page.getByRole('heading', { name: 'Broncos Trivia' }).waitFor();
    await page.getByRole('button', { name: /^A / }).waitFor();
    await page.getByRole('button', { name: /^A / }).click();
    await page.locator('[data-state="correct"]').waitFor();
    await page.getByText('Question 2 of 10', { exact: true }).waitFor();
    console.log(
      'PASS: seven widths; real group correct/incorrect/timeout; ten advances; authoritative ranking/activity; completion; buddies navigation.',
    );
  } finally {
    await browser.close();
    for (const id of users) await sql`DELETE FROM trivia_games WHERE created_by_user_id=${id}`;
    for (const id of users) await sql`DELETE FROM users WHERE id=${id}`;
    await sql.end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
