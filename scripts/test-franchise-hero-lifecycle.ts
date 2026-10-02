import { heroStoryKey } from '../packages/front-office/hero-story';
import { getFrontOfficePhaseActions } from '../src/lib/front-office-phase';
import { resignPlayerInState, offerContractInState } from '../src/server/api/store';
import { createDraftSession, getDraftSession, advanceDraftSession } from '../src/server/api/draft';
import { heroOwnershipSnapshot } from '../src/lib/hero-ownership';
import { initialOwnership } from '../src/features/ownership/model';
import { ensureSaveState } from '../src/server/api/store';
import { getActiveSimulationRoster } from '../src/lib/front-office-roster';
/** Local-only disposable save: validates durable story selections through all 18 weeks. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { authDb } from '../src/server/auth/database';
import {
  createFranchiseSimulation,
  startFranchiseAtWeekOne,
  advanceSimulation,
} from '../src/lib/franchise-simulation';
import { createFallbackRegularSeasonSchedule } from '../src/server/front-office/calendar';
import { NFL_LEAGUE_DATA } from '../src/server/data/nfl-data';
import {
  upsertFrontOfficeSaveMetadata,
  saveFranchiseSimulation,
  getFrontOfficeSaveMetadata,
} from '../src/server/front-office/repository';
async function main() {
  if (
    process.env.NODE_ENV === 'production' ||
    !['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL ?? '').hostname)
  )
    throw Error('Local database only');
  const db = authDb(),
    user = randomUUID(),
    saveId = `hero-test-${randomUUID()}`;
  await db`INSERT INTO users(id,display_name) VALUES(${user},'Disposable hero test')`;
  try {
    const teams = NFL_LEAGUE_DATA.teams.map((t) => ({
      abbr: t.abbr,
      conference: t.conference,
      division: t.division,
      overall: t.teamOverview ?? 75,
    }));
    const games = createFallbackRegularSeasonSchedule(
      teams.map((t) => t.abbr),
      2026,
    ).map((g) => ({ id: g.id, week: g.week, homeTeam: g.homeTeam!, awayTeam: g.awayTeam! }));
    let state = startFranchiseAtWeekOne(
      createFranchiseSimulation({
        seed: process.env.HERO_QA_SEED ?? 'hero-qa-fixed',
        season: 2026,
        teams,
        games,
      }),
    );
    state.heroOwnership = heroOwnershipSnapshot(initialOwnership(2026), 2026);
    let metadata = await upsertFrontOfficeSaveMetadata({
      userId: user,
      saveId,
      teamAbbr: 'KC',
      season: 2026,
      selectedPath: 'full',
      simulationPhase: 'week-1',
    });
    const report = [];
    for (let week = 1; week <= 18; week++) {
      if (week > 1)
        state = advanceSimulation(state, `week-${week}`, {
          players: [
            ...NFL_LEAGUE_DATA.players
              .filter((p) => p.teamAbbr !== 'KC')
              .map((p) => ({
                id: p.id,
                name: p.name,
                position: p.position,
                teamAbbr: p.teamAbbr,
                rating: p.rating,
                headshotUrl: p.headshotUrl,
              })),
            ...getActiveSimulationRoster(ensureSaveState(saveId, 'KC', 2026).roster, 'KC').map(
              (p) => ({
                id: p.id,
                name: `${p.firstName} ${p.lastName}`,
                position: p.position,
                teamAbbr: 'KC',
                rating: p.rating ?? 75,
                headshotUrl: p.headshotUrl,
              }),
            ),
          ],
          recapTeamAbbr: 'KC',
        });
      const saved = await saveFranchiseSimulation({
        userId: user,
        saveId,
        expectedVersion: metadata.version ?? 1,
        simulation: state,
      });
      assert.ok(saved?.simulation);
      state = saved.simulation;
      metadata = saved;
      const story = state.heroStories?.[`2026:${week}`];
      assert.ok(story);
      const reload = await getFrontOfficeSaveMetadata(user, saveId);
      assert.deepEqual(reload?.simulation?.heroStories, state.heroStories);
      report.push({
        week,
        template: story.templateId,
        subject: story.subjectName ?? story.visualType,
      });
    }
    assert.equal(Object.keys(state.heroStories ?? {}).length, 18);
    assert.ok(
      Object.values(state.heroStories ?? {}).filter((h) => h.category === 'development').length <=
        1,
    );
    assert.ok(
      Object.values(state.heroStories ?? {}).filter((h) => h.category === 'facility').length <= 1,
    );
    if (process.env.HERO_QA_OFFSEASON === '1') {
      const persist = async () => {
        const saved = await saveFranchiseSimulation({
          userId: user,
          saveId,
          expectedVersion: metadata.version ?? 1,
          simulation: state,
        });
        assert.ok(saved?.simulation);
        state = saved.simulation;
        metadata = saved;
        const restored = await getFrontOfficeSaveMetadata(user, saveId);
        assert.deepEqual(restored?.simulation?.heroStories, state.heroStories);
        const story = state.heroStories?.[heroStoryKey(state)];
        if (story)
          report.push({
            week: 0,
            template: story.templateId,
            subject: story.subjectName ?? story.visualType,
          });
        return story;
      };
      while (state.phase !== 'offseason') {
        state = advanceSimulation(state, getFrontOfficePhaseActions(state.phase).primary.target);
        await persist();
      }
      assert.ok(state.completedAt);
      assert.ok(state.playoffs?.champion);
      state = advanceSimulation(state, 'resign_cut');
      await persist();
      const store = ensureSaveState(saveId, 'KC', 2026);
      const player = store.roster.find((p) => p.headshotUrl && (p.rating ?? 0) >= 80)!;
      resignPlayerInState(store, player.id, 3, 12, 10);
      const signed = await persist();
      assert.equal(signed?.templateId, 'success-re-sign');
      const stable = JSON.stringify(signed);
      await persist();
      assert.equal(JSON.stringify(state.heroStories?.[heroStoryKey(state)]), stable);
      state.heroAcknowledgements = [signed!.postActionId!];
      assert.notEqual((await persist())?.templateId, 'success-re-sign');
      state = advanceSimulation(state, 'scouting_combine');
      assert.equal((await persist())?.visualType, 'combine');
      state = advanceSimulation(state, 'free_agency');
      await persist();
      // Give the disposable signing fixture room to exercise a successful deal.
      store.header.capSpace = 80;
      store.teamCaps.KC = 80;
      state = advanceSimulation(state, 'free_agency_open');
      await persist();
      const freeAgent = store.freeAgents.find(
        (p) =>
          p.headshotUrl &&
          (p.rating ?? 0) >= 75 &&
          !p.isSignedByCpu &&
          !p.isSignedByUser &&
          !['signed', 'active'].includes(p.status.toLowerCase()),
      );
      if (freeAgent) {
        offerContractInState(store, freeAgent.id, 2, 10, 5);
        assert.equal((await persist())?.templateId, 'success-signing');
      }
      state = advanceSimulation(state, 'draft');
      await persist();
      const created = createDraftSession('real', saveId, 7);
      let session = getDraftSession(created.draftSessionId, saveId);
      let checkedClock = false;
      for (let i = 0; i < 230 && session.status !== 'completed'; i++) {
        if (session.picks[session.currentPickIndex]?.ownerTeamAbbr === 'KC' && !checkedClock) {
          state.activeDraft = structuredClone(session);
          assert.equal((await persist())?.templateId, 'on-clock');
          checkedClock = true;
        }
        session = advanceDraftSession(session.id, saveId, 'best_available', true);
      }
      assert.equal(session.status, 'completed');
      assert.ok(checkedClock);
      state.activeDraft = structuredClone(session);
      state.completedDraft = structuredClone(session);
      await persist();
      state = advanceSimulation(state, 'week-1');
      const opener = await persist();
      assert.equal(state.season, 2027);
      assert.equal(opener?.templateId, 'season-opening');
      assert.ok(state.seasonHistory?.[0].heroStories?.['2026:draft']);
    }
    console.log(JSON.stringify({ ok: true, report }, null, 2));
  } finally {
    await db`DELETE FROM users WHERE id=${user}`;
    await db.end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
