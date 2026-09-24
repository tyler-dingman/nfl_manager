import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { TEAM_LIST } from '@/data/teams';
import accents from '../../../public/assets/the-beat-asset-library/config/team-accents.json';
import manifest from '../../../public/assets/the-beat-asset-library/manifest.json';
import { beatFixtures } from './beat-fixtures';
import {
  beatPalette,
  beatTeam,
  classifyBeatGraphic,
  standardVariant,
  validBeatGraphic,
  type BeatGraphicData,
} from './beat-model';

test('all 32 actual app IDs, abbreviations and full names map to configured accents', () => {
  assert.equal(TEAM_LIST.length, 32);
  for (const team of TEAM_LIST) {
    for (const id of [team.id, team.abbr, team.name]) {
      assert.equal(beatTeam(id), team.abbr);
      assert.equal(
        beatPalette(id).accent,
        accents.teams[team.abbr as keyof typeof accents.teams].accent,
      );
    }
  }
  for (const [alias, key] of Object.entries({
    JAC: 'JAX',
    LA: 'LAR',
    STL: 'LAR',
    SD: 'LAC',
    OAK: 'LV',
    WSH: 'WAS',
    GNB: 'GB',
  }))
    assert.equal(beatTeam(alias), key);
  assert.equal(beatPalette('unknown').accent, '#A5ACAF');
  assert.equal(beatPalette('BUF').accent, '#006DCE');
  assert.equal(beatPalette('CIN').accent, '#FB4F14');
  assert.equal(beatPalette('GB').accent, '#FFB612');
  for (const team of ['GB', 'LV', 'MIA']) assert.equal(beatPalette(team).onAccent, '#0b1115');
});
test('unknown and factual categories without structured data are deterministic Standard cards', () => {
  for (const category of [
    'INJURY',
    'CONTRACT',
    'TRANSACTION',
    'QUOTE',
    'GAME',
    'VIDEO',
    'unknown',
  ]) {
    assert.equal(
      classifyBeatGraphic({ id: 'stable-id', category }).family,
      standardVariant('stable-id'),
    );
  }
  assert.equal(classifyBeatGraphic({ id: 'a', category: 'COACHING' }).family, 'coaching');
  assert.equal(classifyBeatGraphic({ id: 'a', category: 'AROUND_NFL' }).family, 'league');
  assert.equal(new Set(Array.from({ length: 32 }, (_, i) => standardVariant(String(i)))).size, 4);
});
test('all twenty recipes have valid typed fixtures; missing data and oversized identities fall back', () => {
  const valid = beatFixtures.filter((f) => validBeatGraphic(f.graphic));
  for (const family of Object.keys(manifest.recipes))
    assert(
      valid.some((f) => f.graphic.family === family),
      family,
    );
  for (const family of [
    'game-matchup',
    'game-result',
    'numbered',
    'stats',
    'player',
    'injury',
    'transaction',
    'quote',
    'developing',
    'business-community',
    'video',
  ]) {
    const graphic = { family } as BeatGraphicData;
    assert.equal(
      classifyBeatGraphic({ id: 'invalid', category: 'unknown', graphic }).family,
      standardVariant('invalid'),
      family,
    );
  }
  assert.equal(
    validBeatGraphic({
      family: 'player',
      name: 'A name which cannot possibly fit the two-line identity',
      position: 'OT',
    }),
    false,
  );
  assert.equal(
    validBeatGraphic({
      family: 'game-result',
      home: 'KC',
      away: 'BUF',
      homeScore: 0,
      awayScore: 10,
      final: 'FINAL',
    }),
    true,
  );
  assert.equal(
    validBeatGraphic({ family: 'video', title: 'Film', mediaUrl: 'javascript:alert(1)' }),
    false,
  );
});
test('SVG assets remain trusted ID-free geometry with four separated transaction chevrons', () => {
  assert.equal(manifest.assets.length, 33);
  for (const asset of manifest.assets) {
    const svg = readFileSync(`public/assets/the-beat-asset-library/${asset.path}`, 'utf8');
    assert.match(svg, /viewBox="0 0 320 180"/);
    assert.doesNotMatch(svg, /<(?:text|image|script|foreignObject)\b|\bid=|\bhref=|url\(/);
    if (asset.id === 'directional-four-chevrons')
      assert.equal((svg.match(/<path /g) || []).length, 4);
  }
});
test('The Beat opts into new cards while other existing consumers retain legacy defaults', () => {
  const hub = readFileSync('src/components/team-content-hub.tsx', 'utf8');
  assert.match(hub, /appearance="beat"/);
  assert.match(hub, /teamId=\{teamAbbr\}/);
  for (const file of [
    'src/components/down-distance-home.tsx',
    'src/components/game-day/game-day-page.tsx',
  ])
    assert.doesNotMatch(readFileSync(file, 'utf8'), /appearance="beat"/);
});
