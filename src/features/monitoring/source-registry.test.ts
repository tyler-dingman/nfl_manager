import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getAllMonitoringSources,
  getMonitoringSources,
  getMonitoringTeamIds,
} from '@/data/sources/monitoring';
import { TEAM_SOURCE_PROFILES } from '@/data/sources/monitoring/team-baselines';
import { TEAM_LIST } from '@/data/teams';

test('monitoring registry covers all 32 NFL teams with unique source ids', () => {
  assert.deepEqual(new Set(getMonitoringTeamIds()), new Set(TEAM_LIST.map((team) => team.abbr)));
  assert.equal(Object.keys(TEAM_SOURCE_PROFILES).length, 32);
  const allSources = getAllMonitoringSources();
  assert.equal(new Set(allSources.map((source) => source.id)).size, allSources.length);
  assert.equal(
    allSources.filter((source) => source.teamId === 'NFL' && source.platform === 'X').length,
    5,
  );
});

test('every new team baseline includes official, SB Nation, FanSided, and national tier-one sources', () => {
  for (const team of TEAM_LIST.filter((item) => item.abbr !== 'KC')) {
    const sources = getMonitoringSources(team.abbr);
    const liveRss = sources.filter(
      (source) => source.ingestionMethod === 'RSS_ATOM' && source.availability === 'LIVE',
    );
    assert.equal(liveRss.length, 3, `${team.abbr} live RSS baseline`);
    assert.ok(sources.some((source) => source.id === `${team.abbr}_OFFICIAL_NEWS`));
    assert.ok(sources.some((source) => source.id === `${team.abbr}_SB_NATION`));
    assert.ok(sources.some((source) => source.id === `${team.abbr}_FANSIDED`));
    assert.equal(
      sources.filter((source) => source.tier === 1 && source.platform === 'X').length,
      5,
      `${team.abbr} national reporter baseline`,
    );
  }
});

test('requested example team publications are present', () => {
  assert.ok(getMonitoringSources('KC').some((source) => source.name === 'Arrowhead Pride'));
  assert.ok(getMonitoringSources('CHI').some((source) => source.name === 'Windy City Gridiron'));
  assert.ok(getMonitoringSources('CAR').some((source) => source.name === 'Cat Scratch Reader'));
  assert.ok(getMonitoringSources('JAX').some((source) => source.name === 'Black and Teal'));
  assert.ok(getMonitoringSources('BUF').some((source) => source.name === 'BuffaLowDown'));
});
