/** Local-only integration check. Synthetic user/franchises are removed in finally. */
import { loadEnvConfig } from '@next/env';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
loadEnvConfig(process.cwd());
async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname))
    throw new Error('Local database required');
  const { authDb } = await import('../src/server/auth/database');
  const {
    persistFrontOfficeEvents,
    frontOfficeNewsCounts,
    countUnreadFrontOfficeNews,
    listFrontOfficeEvents,
    updateFrontOfficeEvent,
    markAllFrontOfficeEventsRead,
  } = await import('../src/server/front-office/events-repository');
  const { generateFrontOfficeEvents } = await import('../src/server/front-office/event-engine');
  const { createFranchiseSimulation, advanceSimulation } =
    await import('../src/lib/franchise-simulation');
  const { createFallbackRegularSeasonSchedule } =
    await import('../src/server/front-office/calendar');
  const { NFL_LEAGUE_DATA } = await import('../src/server/data/nfl-data');
  const { isFrontOfficeNewsNotification } =
    await import('../src/lib/front-office-news-notifications');
  const db = authDb(),
    user = randomUUID(),
    save = `news-qa-${randomUUID()}`,
    other = `news-qa-${randomUUID()}`;
  const teams = NFL_LEAGUE_DATA.teams.map((t) => ({
    abbr: t.abbr,
    conference: t.conference,
    division: t.division,
    overall: t.teamOverview ?? 80,
  }));
  const players = NFL_LEAGUE_DATA.players.map((p) => ({
    id: p.id,
    name: p.name,
    teamAbbr: p.teamAbbr,
    position: p.position,
    rating: p.rating,
  }));
  let simulation = createFranchiseSimulation({
    seed: 'news-season-qa',
    season: 2026,
    teams,
    games: createFallbackRegularSeasonSchedule(
      teams.map((t) => t.abbr),
      2026,
    ).map((g) => ({ ...g, homeTeam: g.homeTeam!, awayTeam: g.awayTeam! })),
  });
  try {
    await db`INSERT INTO users(id,display_name) VALUES(${user},'News integration QA')`;
    for (const id of [save, other])
      await db`INSERT INTO user_front_office_saves(user_id,save_id,team_abbr,season,simulation_state) VALUES(${user},${id},'KC',2026,${db.json(simulation as any)})`;
    assert.equal(await countUnreadFrontOfficeNews(user, save), 0);
    const weekly = [];
    for (let week = 1; week <= 17; week++) {
      const previous = simulation;
      simulation = advanceSimulation(previous, `week-${week + 1}`, {
        players,
        recapTeamAbbr: 'KC',
      });
      const events = generateFrontOfficeEvents({
        saveId: save,
        teamAbbr: 'KC',
        previous,
        current: simulation,
      }).filter(isFrontOfficeNewsNotification);
      await db.begin(async (tx) => {
        await tx`UPDATE user_front_office_saves SET simulation_state=${tx.json(simulation as any)} WHERE user_id=${user} AND save_id=${save}`;
        await persistFrontOfficeEvents(user, events, tx as unknown as typeof db);
      });
      assert.equal(
        (await persistFrontOfficeEvents(user, events)).length,
        0,
        'retry must not duplicate',
      );
      weekly.push({
        week,
        league: events.filter((e) => e.teamAbbr !== 'KC').length,
        team: events.filter((e) => e.teamAbbr === 'KC').length,
        unread: await countUnreadFrontOfficeNews(user, save),
      });
    }
    const counts = await frontOfficeNewsCounts(user, save, 'KC');
    assert.ok(counts.all >= 40);
    assert.ok(
      counts.categories.every((c) => c.category),
      'all stories must retain JSON metadata',
    );
    assert.equal(await countUnreadFrontOfficeNews(user, save), counts.all);
    assert.equal(await countUnreadFrontOfficeNews(user, other), 0);
    const preview = await listFrontOfficeEvents(user, save, false, 0, true, {
      limit: 10,
      team: 'KC',
    });
    assert.equal(preview.length, 10);
    assert.equal(await countUnreadFrontOfficeNews(user, save), counts.all, 'preview must not read');
    const next = await listFrontOfficeEvents(user, save, false, 10, true, {
      limit: 10,
      team: 'KC',
    });
    assert.ok(next.every((e) => !preview.some((p) => p.id === e.id)));
    const chiefs = await listFrontOfficeEvents(user, save, false, 0, true, {
      query: 'Chiefs',
      team: 'KC',
    });
    assert.ok(chiefs.length > 0, 'team-name search');
    await updateFrontOfficeEvent(user, preview[0].id, 'read');
    assert.equal(await countUnreadFrontOfficeNews(user, save), counts.all - 1);
    for (const [index, type] of (['cut', 'signing', 'trade'] as const).entries()) {
      const next = structuredClone(simulation);
      next.transactions.push({
        id: `qa-action-${index}`,
        type,
        teamAbbr: 'KC',
        relatedTeamAbbr: type === 'trade' ? 'BUF' : undefined,
        playerName: 'QA Player',
        playerRating: 92,
        summary: `QA committed ${type}`,
        createdAt: new Date().toISOString(),
      });
      const generated = generateFrontOfficeEvents({
        saveId: save,
        teamAbbr: 'KC',
        previous: simulation,
        current: next,
      }).filter(isFrontOfficeNewsNotification);
      assert.equal(generated.length, 1);
      const beforeCount = await countUnreadFrontOfficeNews(user, save);
      assert.equal((await persistFrontOfficeEvents(user, generated)).length, 1);
      assert.equal((await persistFrontOfficeEvents(user, generated)).length, 0);
      assert.equal(await countUnreadFrontOfficeNews(user, save), beforeCount + 1);
      const mine = await listFrontOfficeEvents(user, save, false, 0, true, {
        team: 'KC',
        filter: 'team',
      });
      assert.ok(mine.some((e) => e.id === generated[0].id));
      simulation = next;
    }
    assert.equal((await frontOfficeNewsCounts(user, save, 'KC')).breaking, 1);
    await markAllFrontOfficeEventsRead(user, save);
    assert.equal(await countUnreadFrontOfficeNews(user, save), 0);
    await db`DELETE FROM front_office_events WHERE user_id=${user} AND save_id=${save}`;
    assert.equal((await frontOfficeNewsCounts(user, save, 'KC')).all, 0);
    console.log(
      JSON.stringify(
        {
          weekly,
          counts,
          checks:
            'persistence, retry dedupe, preview, pagination, team search, individual/all read, isolation and reset passed',
        },
        null,
        2,
      ),
    );
  } finally {
    await db`DELETE FROM users WHERE id=${user}`;
    await db.end();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
